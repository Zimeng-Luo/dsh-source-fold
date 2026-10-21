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
dsh plugin --profile web add ./dsh-source-fold-0.1.1.tgz
```

包内已包含宿主入口、浏览器入口和 Cordis bundle patch，不需要 npm install 或编译。

### 从 0.1.0 更新或恢复启动

关闭 DSH 后，在原来安装插件的 profile 中重新安装修复版。桌面端命令：

```bash
dsh plugin --profile desktop remove dsh-source-fold
dsh plugin --profile desktop add github:Zimeng-Luo/dsh-source-fold#main
```

随后完全退出并重新启动 DSH。若原来使用其他 profile，请替换 `desktop`。
没有可用 CLI 时，可在插件管理界面移除旧插件，再从本仓库重新安装；若错误页无法进入插件管理，请使用 CLI。
仅重启不会更新已经安装的 0.1.0 文件。

## 兼容性与当前验证情况

当前版本 **0.1.1** 修复了桌面端 `0.2.1-rc.2` 报出的 `Unexpected token 'export'` 启动错误。0.1.0 错把浏览器入口以 ES Module 源码发布；修复版将入口注册到 DSH 的 `window.__ModuleLoader__`，以普通脚本加载。

已在 V8 中复现旧版错误，并通过 6 项以模拟加载器和生命周期环境运行的回归检查：模块注册、合并脚本加载、激活与卸载、实例替换、DOM 就绪后启动和提前卸载取消启动。仓库提供 `npm test` 以 Node 的 `vm` 普通脚本环境重跑同一组检查，`npm pack` 前会自动执行。

**当前开发环境仍不可用，尚未执行 Node 测试命令、npm 打包，或在真实 Windows / Electron / DSH 中实测模型折叠。**

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

浏览器入口是自包含的普通脚本，通过 `window.__ModuleLoader__.load({ id, factory })` 注册；工厂返回 Cordis 插件的 `name`、`inject` 和 `apply`，宿主入口仍为 Node ES Module。DOM 尚未就绪时延迟挂载，并允许卸载时取消。

浏览器端以属性和 CSS 增强原生分组，不移动或删除 React 管理的节点。
菜单变化通过 MutationObserver 合并到下一动画帧处理；卸载时恢复标题属性、模型可见性并清理监听器。

## 变更记录

### 0.1.1

- 修复浏览器入口格式导致的 `Unexpected token 'export'` 启动失败。
- 增加客户端加载与清理的回归测试，以及打包前检查。
- 等待 DOM 就绪后再挂载，卸载时取消等待。

## License

MIT
