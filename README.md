# HTML Table Generator

一个纯静态的可视化表格生成器，用 HTML、CSS 和原生 JavaScript 实现。项目不依赖构建工具和第三方运行时库，适合直接部署到 GitHub Pages。

在线访问地址：

https://kelei321.github.io/html-table-generator/

## 功能

- 可视化编辑表格内容
- 新增、删除行列
- 单元格合并与拆分，支持已合并单元格继续参与合并
- 拖拽调整整列宽度和整行高度
- 单元格字号、颜色、背景、边框、对齐和文字样式编辑
- CSV / TSV 数据导入
- HTML / CSS / 完整文件导出抽屉
- 复制导出代码和下载 HTML 文件
- 本地自动保存到 `localStorage`
- 编辑区缩放和空白区域拖动平移
- 键盘操作、复制粘贴、撤销和重做

## 本地运行

项目使用 ES Modules，现代浏览器不能直接通过 `file://` 加载模块脚本。请使用本地静态服务运行：

```bash
node server.cjs
```

然后访问：

```text
http://127.0.0.1:4173/
```

也可以使用任意其他静态文件服务器，只要把仓库根目录作为站点根目录即可。

## 项目结构

```text
.
├── index.html          # 应用页面入口
├── styles.css          # 全局样式、布局、抽屉、表格和交互状态
├── app.js              # ES Modules 启动入口
├── server.cjs          # 本地静态预览服务器
└── src/
    ├── config.js       # 常量、默认样式、默认尺寸
    ├── state.js        # 应用状态、历史记录、本地保存和数据迁移
    ├── table-model.js  # 表格数据模型、行列操作、合并拆分、尺寸调整
    ├── selection.js    # 选区规范化、框选和可见单元格计算
    ├── exporter.js     # HTML / CSS / 完整文件导出
    ├── ui.js           # DOM 引用、渲染、抽屉、toast、缩放
    └── events.js       # 鼠标、键盘、剪贴板、右键菜单和控件事件
```

## 验证

```bash
node --check app.js
node --check server.cjs
```

PowerShell 中可检查所有模块：

```powershell
Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-ChildItem tests/e2e -Filter *.cjs | ForEach-Object { node --check $_.FullName }
```

浏览器回归测试需要本机 Node 环境可加载 Playwright：

```bash
node tests/e2e/run.cjs
```

## GitHub Pages

本仓库通过 GitHub Actions 自动部署 GitHub Pages。

- 推送到 `main` 分支时自动触发部署
- 也可以在 Actions 页面手动运行 `Deploy GitHub Pages`
- 发布地址为 `https://kelei321.github.io/html-table-generator/`

如果 Pages 未立即生效，请在 GitHub 仓库设置中确认：

1. 进入 `Settings` -> `Pages`
2. `Build and deployment` 的 `Source` 选择 `GitHub Actions`
3. 回到 `Actions` 查看 `Deploy GitHub Pages` workflow 是否执行成功

## 说明

- 项目无构建步骤，GitHub Pages 直接发布仓库根目录中的静态文件。
- 导出的 HTML/CSS 不包含编辑器 UI、缩放状态或拖拽手柄。
- 表格尺寸会保存到浏览器本地存储；清空浏览器站点数据会重置保存内容。
