# Performance Optimization Guide

## Quick Performance Testing

### 1. Test Production Build (Recommended)
Development builds are inherently slower. Test performance with a production build:

```bash
# Android Production Build
cd android
./gradlew assembleRelease
# Install the APK from: android/app/build/outputs/apk/release/

# iOS Production Build
cd ios
xcodebuild -workspace YourApp.xcworkspace -scheme YourApp -configuration Release
```

### 2. Enable Performance Monitoring
Add React DevTools Profiler to identify bottlenecks:
- Install React DevTools browser extension
- Use the Profiler tab to record interactions
- Look for components with long render times

### 3. Check Bundle Size
```bash
# Analyze bundle size
npx react-native-bundle-visualizer
```

## Optimizations Applied

### ✅ Completed Optimizations

1. **Removed Console Logs**
   - Removed all `console.log` statements from production code
   - Only error logs remain for debugging

2. **Animation Optimizations**
   - Removed `scaleAnim` from all screens (reduces animation overhead)
   - Added `InteractionManager.runAfterInteractions()` for optimized timing
   - Reduced animation duration from 350ms to 250ms
   - Changed to `Easing.out(Easing.ease)` for smoother transitions

3. **Memoization**
   - Added `useMemo` for expensive computations (filtered arrays, date calculations)
   - Added `useCallback` for event handlers to prevent re-renders
   - Memoized components with `React.memo` where appropriate

4. **Code Splitting**
   - Components are properly separated
   - Modals are lazy-loaded

## Performance Tips

### For Development
1. **Use Hermes Engine** (if not already enabled)
   - Check `android/app/build.gradle` for `enableHermes: true`
   - Significantly improves JavaScript performance

2. **Disable Debug Mode**
   - Turn off remote debugging when not needed
   - Close React DevTools when not profiling

3. **Reduce Logging**
   - All console.logs have been removed
   - Use `__DEV__` flag for development-only logs if needed

### For Production
1. **Enable ProGuard/R8** (Android)
   - Already configured in `android/app/build.gradle`
   - Reduces APK size and improves performance

2. **Optimize Images**
   - Use WebP format where possible
   - Compress images before adding to assets
   - Use appropriate image sizes for different densities

3. **Monitor Performance**
   - Use Flipper for performance monitoring
   - Check memory usage regularly
   - Monitor frame rate (should be 60fps)

## Common Performance Issues

### Issue: Slow Navigation
**Solution**: Already optimized with `InteractionManager` and reduced animations

### Issue: Laggy Lists
**Solution**: 
- Use `FlatList` instead of `ScrollView` for long lists
- Implement `getItemLayout` for known item sizes
- Use `removeClippedSubviews={true}`

### Issue: Heavy Re-renders
**Solution**: 
- All handlers now use `useCallback`
- Expensive computations use `useMemo`
- Components are memoized where needed

## Testing Performance

### 1. Frame Rate Monitoring
```bash
# Enable performance overlay
# In your app, shake device and select "Show Perf Monitor"
```

### 2. Memory Profiling
- Use React DevTools Profiler
- Check for memory leaks in long-running sessions
- Monitor component mount/unmount cycles

### 3. Network Performance
- Check API response times
- Implement request caching where appropriate
- Use pagination for large datasets

## Additional Recommendations

1. **Code Splitting**: Consider lazy loading screens that aren't immediately needed
2. **Image Optimization**: Compress all images and use appropriate formats
3. **Database Optimization**: If using local storage, optimize queries
4. **Network Caching**: Cache API responses to reduce network calls

## Notes

- Development builds will always be slower than production
- Metro bundler adds overhead in development
- Hot reloading can cause temporary slowdowns
- Production builds are typically 2-3x faster

