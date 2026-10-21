# DSH Source Fold · 模型来源折叠

给 **DeepSeek Harness（DSH）聊天输入框的模型选择器**添加按来源折叠。
多个提供商的模型不用全部铺开，点击来源标题即可展开或收起。

```text
▾ 来源 A（2）
    模型 1
    模型 2
▸ 来源 B（18）
▸ 来源 C（32）
```

## 功能

- 每个来源独立展开或收起，使用来源 ID 保存状态，避免同名来源互相影响。
- 没有保存记录时，只展开当前模型所属来源。
- 关闭菜单、刷新页面后记住折叠状态；存储不可用时退回内存状态。
- 搜索时临时展开命中结果，清空搜索后恢复保存状态。
- 来源标题支持 Enter / 空格切换。
- 使用原生方向键、Tab 或 Enter 导航模型时，临时展开完整列表，避免确认隐藏项；重新打开菜单后恢复保存状态。
- 保留原生模型选择、推理等级和加载错误处理。
- 无额外依赖，无构建步骤，插件本身不发起网络请求。

## 安装

Web 版：

```bash
dsh plugin --profile web add github:Zimeng-Luo/dsh-source-fold
```

桌面版：

```bash
dsh plugin --profile desktop add github:Zimeng-Luo/dsh-source-fold
```

安装后重启对应的 DSH 实例并刷新界面。自定义 profile 请替换命令里的名称。
如果未安装全局 `dsh`，可将命令前的 `dsh` 替换为 `npx @deepseek-ai/dsh`。

### 本地打包安装

```bash
git clone https://github.com/Zimeng-Luo/dsh-source-fold.git
cd dsh-source-fold
npm run check
npm pack
dsh plugin --profile web add ./dsh-source-fold-0.1.0.tgz
```

包内已包含宿主入口、浏览器入口和 Cordis bundle patch，不需要 npm install 或编译。

## 兼容性与当前验证情况

这是供安装试用的 0.1.0 初版。开发环境未能启动，**尚未在真实 DSH 中运行实测，也未执行 npm 打包或 DSH 安装验证**。

实现参照官方模型选择器当前源码，要求菜单包含以下结构：

- 来源分组：`section[role="group"][aria-labelledby]`
- 模型按钮：`button[role="menuitemradio"]`
- 模型标签：`[data-provider-id]`
- 浮层由 `[aria-haspopup="menu"][aria-controls]` 触发按钮关联

参照代码：
[ModelSelect.tsx](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-model-selection/src/client/ModelSelect.tsx)
和 [MenuGroup.tsx](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/MenuGroup.tsx)。

仅增强聊天输入框的模型下拉菜单；不增强 `/model` 命令弹窗或设置页。
缺少上述结构的旧版或定制版不会启用折叠。
请避免同时启用其他替换或折叠模型选择器的插件。

搜索期间保持结果可见，因此点击来源标题不会收起结果。折叠状态按浏览器来源存储，不跨设备同步。

## 试用检查

1. 配置至少两个模型来源，打开模型列表，确认仅当前来源默认展开。
2. 分别点击来源标题，确认 A、B 的状态相互独立。
3. 关闭再打开菜单、刷新页面，确认保存状态仍然有效。
4. 搜索一个位于已收起来源中的模型，确认结果可见；清空后恢复折叠。
5. 选择模型后确认原生模型切换、推理等级和失败提示正常。
6. 使用方向键导航，确认模型列表临时展开，重新打开后恢复折叠。
7. 若无效果，反馈 DSH 版本和模型菜单的上述 DOM 结构，勿提交 API Key。

## 实现

浏览器端以属性和 CSS 增强原生分组，不移动或删除 React 管理的节点。
菜单变化通过 MutationObserver 合并到下一动画帧处理；卸载时恢复标题属性、模型可见性并清理监听器。

## License

MIT
