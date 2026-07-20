import { test, expect } from '@playwright/test';

test.describe('Main Menu', () => {
  test('should display main menu with all buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SPACE FIGHTER/i);
    await expect(page.getByRole('button', { name: /开始游戏/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /设置/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /成就/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /商店/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /排行榜/i })).toBeVisible();
  });

  test('should navigate to settings when settings button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /设置/i }).click();
    await expect(page.getByRole('heading', { name: /设置/i })).toBeVisible();
  });

  test('should navigate to level select when start game is clicked', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /开始游戏/i }).click();
    await expect(page.getByRole('heading', { name: /选择关卡/i })).toBeVisible();
  });
});

test.describe('Settings', () => {
  test('should toggle audio volume', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /设置/i }).click();
    await page.getByRole('tab', { name: /音频/i }).click();
    const volumeSlider = page.locator('input[type="range"]').first();
    await expect(volumeSlider).toBeVisible();
  });

  test('should switch theme', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /设置/i }).click();
    await page.getByRole('tab', { name: /主题/i }).click();
    await page.getByRole('button', { name: /浅色/i }).click();
    await expect(page.locator('body')).toHaveClass(/light/);
  });
});
