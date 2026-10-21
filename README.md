# DSH Source Fold · 模型岛

为 **DeepSeek Harness** 的模型按钮提供一张可展开、收回的圆角控制卡片：按来源逐级选择模型，用分档滑块调整当前模型实际支持的思考强度。

## 交互

1. 点击输入框旁的模型按钮，弹出控制卡片。
2. 卡片上方显示当前思考档位，中间显示模型名称，下方是滑块。
3. 点击卡片中的模型名称，进入 **来源列表**。
4. 点击来源，新的 **模型列表从右侧滑入**；左上角返回按钮可退回来源列表。
5. 选择模型后应用切换，卡片回到思考强度页；点外部或再次点击入口会收回。

来源行高约 **64px**，模型行高约 **54px**，采用更大的文字和触控区域。来源和模型分别支持搜索，来源列表也可以按其模型名称搜索。

## 思考强度

- 最左端始终为 **Default**：提交时不携带 `reasoningEffort`，由模型配置决定默认值；它不是虚构的 `"default"` 档位，也不等同于最低推理量。
- 后续档位来自当前模型的 `reasoning.efforts` 元数据，保留提供方顺序，不硬编码 Low / Medium / High。
- 没有可调档位的模型会隐藏滑块。
- 拖动时只预览，松手、键盘调节结束或失焦时提交，避免拖动中连续请求。
- 右上角重置按钮恢复 Default。若宿主将 Default 展开为实际档位，当前卡片仍保留用户刚选择的 Default 位置。
- 切换到新模型时使用该模型默认值，不把旧模型的推理档位带过去。

## 动效

展开和收回使用轻微缩放、位移和模糊，宽度、高度和圆角随页面变化过渡；来源与模型页面共享一条水平滑动轨道。滑块有跟手预览、圆形滑块和档位吸附。

开启系统的“减少动态效果”时会关闭位移与缩放过渡。

## 安装 / 更新

桌面版：

```bash
dsh plugin --profile desktop remove dsh-source-fold
dsh plugin --profile desktop add github:Zimeng-Luo/dsh-source-fold#main
```

首次安装跳过 remove；Web 版把 `desktop` 改为 `web`，自定义 profile 使用其原名称。完成后完全退出并重启 DSH；仅重启不会下载新代码。

当前版本：**0.2.0**。仓库已包含可直接加载的 `client.js`，使用者无需构建或额外安装 React。

本插件接管 `conversation.input.model` 入口；同类模型选择或思考强度界面插件（例如 `dsh-thinking-levels`）可能被覆盖，建议试用时只启用一个。卸载后恢复原生入口。`/model` 命令仍由官方组件提供。

## 交互预览

仓库包含 [preview.html](./preview.html)，与插件共用 **同一个客户端组件**，使用示例模型目录，不发送真实模型请求。

下载仓库后，可在目录中运行任意静态 HTTP 服务器，例如：

```bash
python -m http.server 8080
```

然后打开 `http://localhost:8080/preview.html`。预览通过 jsDelivr 加载 React 18；**实际 DSH 插件不依赖这个 CDN**，而是复用宿主提供的 React。示例模型与档位仅用于展示交互。

## 开发与检查

Node.js 18 或更新版本，无额外 npm 依赖：

```bash
npm run build
npm run check
npm pack
```

- `src/logic.js`：目录解析、Default 语义、搜索与浮层位置计算。
- `src/island.js`：React 交互组件。
- `src/island.css`：布局、滑块与动效。
- `src/plugin.js`：官方 Slot 与模型目录的接入。
- `scripts/build.cjs`：生成 DSH 所需的普通脚本工厂入口。
- `npm run check` 检查生成产物是否同步，并执行加载、数据与交互回归检查。

浏览器入口通过 `window.__ModuleLoader__.load({ id, factory })` 注册，复用宿主的 React / React DOM。模型目录、选择请求、推理元数据及会话归属来自官方 `modelDirectories` 服务，不读取私有配置，不通过 DOM 猜测或模拟点击切换模型。

## 兼容性与验证边界

接口参照 DSH Desktop **0.2.1-rc.2** 对应的官方模型目录与 Slot 代码。需要默认的 `ui-model-selection`、`api-session-controller` 和 `ui-renderer` 客户端组件。

已在 V8 中通过 **13 项检查**，使用模拟的加载器、目录控制器和 React Hook 环境验证：

- 普通脚本注册、多个插件脚本合并加载。
- 接管 Slot、使用共享目录、子代理隐藏、卸载清理。
- Default 请求语义、自适应档位、元数据去重、不支持时隐藏。
- 来源进入模型、返回、准确的来源与模型选择请求、错误保留。
- 拖动不提交、松手只提交一次、切换模型后采用新档位。
- 长列表的浮层边界和来源搜索。

**开发环境仍未能启动，尚未运行 Node / npm 命令，也未在真实 Electron / Windows / DSH 或浏览器中验证渲染、动效、鼠标与触摸事件。**上述检查不替代真实界面试用。

## 版本记录

### 0.2.0

用来源 → 模型的分层选择和自适应思考滑块替换 0.1.x 的 DOM 折叠方式，加入更大的条目、圆角悬浮卡片、展开收回和页面滑动动效。

### 0.1.1

修复浏览器入口作为 ES Module 发布导致的 `Unexpected token 'export'`。

## License

MIT
