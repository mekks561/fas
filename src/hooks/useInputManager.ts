import { useRef, useEffect, useCallback, useMemo } from 'react';
import { InputManager } from '../InputManager';
import { IShipControls, IKeyBindings } from '../types';

export const useInputManager = (
  canvas: HTMLCanvasElement | null,
  keyBindings?: Partial<IKeyBindings>,
) => {
  const inputManagerRef = useRef<InputManager | null>(null);

  useEffect(() => {
    if (!canvas) return;

    // 创建InputManager实例
    inputManagerRef.current = new InputManager(canvas, keyBindings);

    // 清理函数
    return () => {
      if (inputManagerRef.current) {
        inputManagerRef.current.dispose();
        inputManagerRef.current = null;
      }
    };
  }, [canvas, keyBindings]);

  // 获取控制状态
  const getControls = useCallback((): IShipControls => {
    return (
      inputManagerRef.current?.getControls() || {
        forward: false,
        backward: false,
        left: false,
        right: false,
        up: false,
        down: false,
        rollLeft: false,
        rollRight: false,
        boost: false,
        fire: false,
      }
    );
  }, []);

  // 获取鼠标Delta
  const getMouseDelta = useCallback(() => {
    return inputManagerRef.current?.getMouseDelta() || { x: 0, y: 0 };
  }, []);

  // 检查特定按键
  const isKeyPressed = useCallback((key: string): boolean => {
    return inputManagerRef.current?.isKeyPressed(key) || false;
  }, []);

  // 鼠标按键检查
  const isMouseButtonPressed = useCallback((button: number): boolean => {
    return inputManagerRef.current?.isMouseButtonPressed(button) || false;
  }, []);

  // 鼠标灵敏度控制
  const setMouseSensitivity = useCallback((sensitivity: number) => {
    inputManagerRef.current?.setMouseSensitivity(sensitivity);
  }, []);

  const getMouseSensitivity = useCallback((): number => {
    return inputManagerRef.current?.getMouseSensitivity() || 0.003;
  }, []);

  // 按键绑定管理
  const setKeyBindings = useCallback((bindings: Partial<IKeyBindings>) => {
    inputManagerRef.current?.setKeyBindings(bindings);
  }, []);

  const getKeyBindings = useCallback((): IKeyBindings => {
    return inputManagerRef.current?.getKeyBindings() || {};
  }, []);

  const resetKeyBindings = useCallback(() => {
    inputManagerRef.current?.resetKeyBindings();
  }, []);

  const addKeyBinding = useCallback((action: keyof IKeyBindings, key: string) => {
    inputManagerRef.current?.addKeyBinding(action, key);
  }, []);

  const removeKeyBinding = useCallback((action: keyof IKeyBindings, key: string) => {
    inputManagerRef.current?.removeKeyBinding(action, key);
  }, []);

  // 组合键支持
  const checkCombo = useCallback((combo: string[]): boolean => {
    return inputManagerRef.current?.checkCombo(combo) || false;
  }, []);

  const registerCombo = useCallback((combo: string[], callback: () => void, timeout?: number) => {
    inputManagerRef.current?.registerCombo(combo, callback, timeout);
  }, []);

  // 调试工具
  const enableDebugMode = useCallback(() => {
    inputManagerRef.current?.enableDebugMode();
  }, []);

  const disableDebugMode = useCallback(() => {
    inputManagerRef.current?.disableDebugMode();
  }, []);

  const getDebugInfo = useCallback(() => {
    return inputManagerRef.current?.getDebugInfo() || null;
  }, []);

  // 输入历史
  const getInputHistory = useCallback(() => {
    return inputManagerRef.current?.getInputHistory() || [];
  }, []);

  const clearInputHistory = useCallback(() => {
    inputManagerRef.current?.clearInputHistory();
  }, []);

  // 额外工具
  const isAnyKeyPressed = useCallback((): boolean => {
    return inputManagerRef.current?.isAnyKeyPressed() || false;
  }, []);

  const getPressedKeys = useCallback((): string[] => {
    return inputManagerRef.current?.getPressedKeys() || [];
  }, []);

  const clearAll = useCallback(() => {
    inputManagerRef.current?.clear();
  }, []);

  // 返回所有可用的方法
  const methods = useMemo(
    () => ({
      inputManagerRef,
      getControls,
      getMouseDelta,
      isKeyPressed,
      isMouseButtonPressed,
      setMouseSensitivity,
      getMouseSensitivity,
      setKeyBindings,
      getKeyBindings,
      resetKeyBindings,
      addKeyBinding,
      removeKeyBinding,
      checkCombo,
      registerCombo,
      enableDebugMode,
      disableDebugMode,
      getDebugInfo,
      getInputHistory,
      clearInputHistory,
      isAnyKeyPressed,
      getPressedKeys,
      clearAll,
    }),
    [
      getControls,
      getMouseDelta,
      isKeyPressed,
      isMouseButtonPressed,
      setMouseSensitivity,
      getMouseSensitivity,
      setKeyBindings,
      getKeyBindings,
      resetKeyBindings,
      addKeyBinding,
      removeKeyBinding,
      checkCombo,
      registerCombo,
      enableDebugMode,
      disableDebugMode,
      getDebugInfo,
      getInputHistory,
      clearInputHistory,
      isAnyKeyPressed,
      getPressedKeys,
      clearAll,
    ],
  );

  return methods;
};
