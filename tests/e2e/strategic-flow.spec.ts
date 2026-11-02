import { test, expect } from '@playwright/test';

test.describe('Strategic Command Flow', () => {
  test('should enter strategic map and jump to a sector', async ({ page }) => {
    // 1. 访问首页
    await page.goto('/');
    
    // 2. 点击“银河战略指挥”按钮
    // 根据 MainMenu.tsx，按钮包含文本“银河战略指挥”
    const strategicButton = page.getByRole('button', { name: /银河战略指挥/i });
    await expect(strategicButton).toBeVisible();
    await strategicButton.click();
    
    // 3. 等待星图 UI 出现
    // 根据 StarMap.tsx，标题包含“银河拓扑图”
    await expect(page.getByText(/银河拓扑图/i)).toBeVisible();
    
    // 4. 等待引擎就绪 (按钮文本从“引擎初始化中...”变为“进入星区”或“启动跃迁”)
    // 我们设置了轮询，应该在几秒内变化
    const jumpButton = page.locator('button:has-text("进入星区"), button:has-text("启动跃迁")');
    await expect(jumpButton).toBeVisible({ timeout: 15000 });
    
    // 5. 点击“进入星区”
    await jumpButton.click();
    
    // 6. 验证是否进入了加载状态或战斗场景
    // 跳转后 StarMap 会关闭，GameScene 会显示加载遮罩
    await expect(page.getByText(/银河拓扑图/i)).not.toBeVisible();
    
    // 检查是否有加载进度条或类似标识 (根据 useGameStore 的 loading 状态)
    // 或者是战斗 UI (例如“护盾”、“能量”等关键词)
    await expect(page.locator('canvas')).toBeVisible();
  });
});
