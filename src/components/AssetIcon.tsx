import { useEffect, useState } from 'react';

interface AssetIconProps {
  /** 配置里的 icon id（如 "icon-shield"），对应 /assets/textures/ui/icons/<id>.png */
  name?: string;
  /** 图标加载失败或未配置时的回落内容（emoji / 字符），保证面板永远可渲染 */
  fallback: string;
  /** 渲染尺寸（px） */
  size?: number;
  className?: string;
  title?: string;
}

/**
 * 配置驱动的 UI 图标：把 config 里的 icon id 拼成真实资源 URL。
 *
 * 这是全仓唯一做「icon id → 路径」拼接的地方——原 AssetManifest.ts（死链）
 * 的这份职责从此活在生产代码里。真图标来源：Kenney Space Shooter Remastered
 * （游戏资源语义）+ Kenney Game Icons（UI 语义），全部 CC0，见 textures/CREDITS.md。
 *
 * 注意：textures/ui/ 根下同名的 40 个 PNG 是生成脚本产出的纯色方块（64×64
 * 单色位图，203~227 字节），不可用；本组件只读 icons/ 子目录。
 */
export function AssetIcon({ name, fallback, size = 32, className, title }: AssetIconProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [name]);
  const url = name ? `/assets/textures/ui/icons/${name}.png` : undefined;
  if (!url || failed) {
    return <span className={className}>{fallback}</span>;
  }
  return (
    <img
      src={url}
      alt={title || fallback}
      title={title}
      width={size}
      height={size}
      className={className}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
