/**
 * Minimal web shim for react-native-reanimated.
 * No imports to avoid circular dependencies.
 */
const noop = () => {};
const identity = (v) => v;
const noopFactory = () => noop;

function useSharedValue(init) { return { value: init }; }
function useAnimatedStyle(fn) { try { return fn(); } catch { return {}; } }
function useDerivedValue(fn) { try { return { value: fn() }; } catch { return { value: undefined }; } }
function useAnimatedGestureHandler(h) { return h; }
function useAnimatedScrollHandler() { return {}; }
function useAnimatedRef() { return { current: null }; }
function useAnimatedReaction() {}

function interpolate(value, inputRange, outputRange) {
  if (!inputRange || !outputRange || inputRange.length < 2) return value;
  if (value <= inputRange[0]) return outputRange[0];
  if (value >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
  for (let i = 0; i < inputRange.length - 1; i++) {
    if (value >= inputRange[i] && value <= inputRange[i + 1]) {
      const ratio = (value - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
      return outputRange[i] + ratio * (outputRange[i + 1] - outputRange[i]);
    }
  }
  return outputRange[0];
}

const Extrapolation = { EXTEND: 'extend', CLAMP: 'clamp', IDENTITY: 'identity' };
const Easing = {
  linear: identity, ease: identity, quad: (t) => t * t, cubic: (t) => t * t * t,
  bezier: () => identity, in: identity, out: identity, inOut: identity,
  bezierFn: () => identity,
};

// No-op animation functions
const withTiming = identity;
const withSpring = identity;
const withDecay = () => 0;
const withDelay = (_, a) => a;
const withSequence = (...a) => a[a.length - 1];
const withRepeat = identity;
const cancelAnimation = noop;
const runOnJS = identity;
const runOnUI = identity;
const measure = () => null;
const scrollTo = noop;
const makeMutable = (v) => ({ value: v });
const createAnimatedComponent = (C) => C;

// Layout animation stubs
const FadeIn = { duration: noopFactory, delay: noopFactory, springify: noopFactory };
const FadeOut = { duration: noopFactory, delay: noopFactory, springify: noopFactory };
const SlideInRight = { duration: noopFactory };
const SlideOutRight = { duration: noopFactory };
const Layout = { duration: noopFactory, springify: noopFactory };
const ZoomIn = { duration: noopFactory };
const ZoomOut = { duration: noopFactory };
const FadeInDown = { duration: noopFactory };
const FadeInUp = { duration: noopFactory };

module.exports = {
  __esModule: true,
  default: { createAnimatedComponent, View: undefined, Text: undefined, ScrollView: undefined, Image: undefined, FlatList: undefined },
  useSharedValue, useAnimatedStyle, useAnimatedGestureHandler, useDerivedValue,
  useAnimatedScrollHandler, useAnimatedRef, useAnimatedReaction,
  withTiming, withSpring, withDecay, withDelay, withSequence, withRepeat,
  cancelAnimation, runOnJS, runOnUI, measure, scrollTo, makeMutable,
  interpolate, Extrapolation, Easing, createAnimatedComponent,
  FadeIn, FadeOut, SlideInRight, SlideOutRight, Layout, ZoomIn, ZoomOut, FadeInDown, FadeInUp,
};
