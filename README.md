# 七夕互动抽签 Demo

一个适合手机竖屏体验的直播间礼物交互原型：

1. 首次轻触粉色签筒，允许浏览器访问手机动作传感器。
2. 摇动手机触发摇签动画。
3. 按住中央发光签并向上滑动。
4. 翻开随机七夕祝福签文，点击“再抽一签”重复体验。

> iPhone 的动作传感器需要 HTTPS 环境和用户主动授权。GitHub Pages 发布后可直接使用；不支持动作传感器的浏览器会自动降级为轻触签筒触发。

## 本地运行

项目是纯静态网页，不需要安装依赖：

```bash
python3 -m http.server 4173
```

然后访问 <http://localhost:4173>。

## 发布

仓库已兼容 GitHub Pages，可从仓库的 `Settings → Pages` 选择 `Deploy from a branch`，并将分支设为 `main / root`。
