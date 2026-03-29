const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { sqlite } = require('../config/database');
const storage = require('./storageService');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const WORK_DIR = path.join(__dirname, '..', '..', 'tmp');

// Quality presets: [label, height, videoBitrate, audioBitrate]
const QUALITY_PRESETS = [
  { label: '1080p', height: 1080, vBitrate: '4000k', minSourceHeight: 1080 },
  { label: '720p',  height: 720,  vBitrate: '2000k', minSourceHeight: 0 },
  { label: '480p',  height: 480,  vBitrate: '800k',  minSourceHeight: 0 },
];

/**
 * Probe a video file to extract metadata.
 * @param {string} inputPath - Absolute path to the video file.
 * @returns {Promise<{duration: number, width: number, height: number, codecs: string}>}
 */
function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream found'));
      resolve({
        duration: Math.round(metadata.format.duration || 0),
        width: videoStream.width,
        height: videoStream.height,
        codecs: `${videoStream.codec_name}/${(metadata.streams.find((s) => s.codec_type === 'audio') || {}).codec_name || 'none'}`,
      });
    });
  });
}

/**
 * Transcode a video to a specific quality level.
 * @returns {Promise<string>} Path to the transcoded file.
 */
function transcodeToQuality(inputPath, outputPath, preset) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('128k')
      .audioFrequency(44100)
      .size(`?x${preset.height}`)
      .videoBitrate(preset.vBitrate)
      .outputOptions([
        '-preset fast',
        '-profile:v main',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Generate an HLS playlist with multiple quality variants.
 * @param {string} inputPath - Source video.
 * @param {string} outputDir - Directory for HLS segments.
 * @param {{label: string, height: number, vBitrate: string}[]} presets - Quality levels to include.
 * @returns {Promise<string>} Path to the master .m3u8 playlist.
 */
async function generateHLS(inputPath, outputDir, presets) {
  fs.mkdirSync(outputDir, { recursive: true });

  // Transcode each quality into its own HLS variant
  for (const preset of presets) {
    const variantDir = path.join(outputDir, preset.label);
    fs.mkdirSync(variantDir, { recursive: true });
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate('128k')
        .audioFrequency(44100)
        .size(`?x${preset.height}`)
        .videoBitrate(preset.vBitrate)
        .outputOptions([
          '-preset fast',
          '-profile:v main',
          '-pix_fmt yuv420p',
          '-hls_time 4',
          '-hls_list_size 0',
          '-hls_segment_filename', path.join(variantDir, 'seg_%03d.ts'),
          '-f hls',
        ])
        .output(path.join(variantDir, 'playlist.m3u8'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  // Write master playlist referencing each variant
  const masterPath = path.join(outputDir, 'master.m3u8');
  const bandwidthMap = { '1080p': 4500000, '720p': 2200000, '480p': 900000 };
  let master = '#EXTM3U\n';
  for (const preset of presets) {
    const bw = bandwidthMap[preset.label] || 1000000;
    master += `#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${Math.round(preset.height * 16 / 9)}x${preset.height}\n`;
    master += `${preset.label}/playlist.m3u8\n`;
  }
  fs.writeFileSync(masterPath, master);
  return masterPath;
}

/**
 * Extract a representative thumbnail from the video.
 * Uses ffmpeg thumbnail filter, then optimizes with sharp to WebP.
 * @param {string} inputPath
 * @param {number} duration - Video duration in seconds.
 * @param {string} outputPath - Desired output path (will be .webp).
 * @returns {Promise<string>} Path to the generated thumbnail.
 */
async function generateThumbnail(inputPath, duration, outputPath) {
  const rawThumb = outputPath.replace(/\.webp$/, '_raw.jpg');
  const seekTime = Math.max(1, Math.floor(duration * 0.25));

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(seekTime)
      .frames(1)
      .outputOptions(['-vf', 'thumbnail,scale=720:-1'])
      .output(rawThumb)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  await sharp(rawThumb).webp({ quality: 80 }).toFile(outputPath);
  fs.unlinkSync(rawThumb);
  return outputPath;
}

/**
 * Main processing pipeline: probe → transcode → thumbnail → HLS → upload → update DB.
 * @param {{videoId: string, inputPath: string}} jobData
 * @param {function} [onProgress] - Callback with progress 0-100.
 */
async function processVideo(jobData, onProgress = () => {}) {
  const { videoId, inputPath } = jobData;
  const jobDir = path.join(WORK_DIR, videoId);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    // Update status → processing
    sqlite.prepare("UPDATE videos SET processing_status = 'processing' WHERE id = ?").run(videoId);
    onProgress(5);

    // Step 1: Probe
    const meta = await probeVideo(inputPath);
    onProgress(10);

    // Step 2: Determine which quality presets to use
    const applicablePresets = QUALITY_PRESETS.filter((p) => meta.height >= p.minSourceHeight);

    // Step 3: Generate HLS with all applicable qualities
    const hlsDir = path.join(jobDir, 'hls');
    await generateHLS(inputPath, hlsDir, applicablePresets);
    onProgress(60);

    // Step 4: Generate thumbnail
    const thumbPath = path.join(jobDir, 'thumb.webp');
    await generateThumbnail(inputPath, meta.duration, thumbPath);
    onProgress(70);

    // Step 5: Upload all outputs to storage
    const storagePrefix = `processed/${videoId}`;

    // Upload thumbnail
    const thumbnailUrl = await storage.upload(thumbPath, `${storagePrefix}/thumb.webp`, 'image/webp');
    onProgress(75);

    // Upload HLS files
    const hlsFiles = getAllFiles(hlsDir);
    for (let i = 0; i < hlsFiles.length; i++) {
      const relative = path.relative(hlsDir, hlsFiles[i]).replace(/\\/g, '/');
      const contentType = hlsFiles[i].endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
      await storage.upload(hlsFiles[i], `${storagePrefix}/hls/${relative}`, contentType);
    }
    const hlsUrl = storage.STORAGE_TYPE === 'local'
      ? `/uploads/${storagePrefix}/hls/master.m3u8`
      : `${storagePrefix}/hls/master.m3u8`;
    onProgress(95);

    // Step 6: Update database
    sqlite
      .prepare(
        `UPDATE videos
         SET thumbnail_url = ?, hls_url = ?, duration = ?, width = ?, height = ?,
             processing_status = 'completed', processed_at = datetime('now')
         WHERE id = ?`
      )
      .run(thumbnailUrl, hlsUrl, meta.duration, meta.width, meta.height, videoId);
    onProgress(100);

    // Cleanup temp files
    fs.rmSync(jobDir, { recursive: true, force: true });
    return { videoId, thumbnailUrl, hlsUrl, duration: meta.duration };
  } catch (err) {
    // Mark as failed
    sqlite
      .prepare("UPDATE videos SET processing_status = 'failed' WHERE id = ?")
      .run(videoId);
    // Cleanup temp files on failure too
    fs.rmSync(jobDir, { recursive: true, force: true });
    throw err;
  }
}

/** Recursively list all files in a directory. */
function getAllFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

module.exports = { processVideo, probeVideo, generateThumbnail, generateHLS };
