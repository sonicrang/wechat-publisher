# WeChat Publisher

基于 [doocs/md](https://github.com/doocs/md) 核心库的 Markdown 转微信公众号发布工具。

## 特性

- ✅ 完整 Markdown 支持（标题、列表、代码块、表格、引用等）
- ✅ 自动上传本地图片到微信素材库
- ✅ 代码高亮（GitHub Dark 主题）
- ✅ 玫瑰金主题样式
- ✅ 配置化管理（AppID/AppSecret/Author）
- ✅ 一键发布到微信公众号草稿箱

## 安装

```bash
cd ~/workspace/wechat-publisher
npm install
```

## 配置

复制配置文件模板并编辑：

```bash
cp config.example.yaml config.yaml
```

编辑 `config.yaml`：

```yaml
wechat:
  appId: "your-app-id"
  appSecret: "your-app-secret"

author: "作者名"
```

**配置说明：**

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `wechat.appId` | ✅ | 微信公众平台 AppID |
| `wechat.appSecret` | ✅ | 微信公众平台 AppSecret |
| `author` | ❌ | 默认作者名 |

## 使用方法

### 发布文章

```bash
# 基本用法（使用配置中的默认作者）
npm run publish article.md

# 指定作者
npm run publish article.md -a "作者名"

# 指定标题
npm run publish article.md -t "文章标题"

# 同时指定标题和作者
npm run publish article.md -t "文章标题" -a "作者名"

# 查看帮助
npm run publish -- --help
```

### 参数说明

| 参数 | 简写 | 说明 |
|------|------|------|
| `--title` | `-t` | 指定文章标题（覆盖 Markdown 中的标题）|
| `--author` | `-a` | 指定作者（覆盖配置文件中的默认作者）|
| `--digest` | `-d` | 指定文章摘要 |
| `--help` | `-h` | 显示帮助 |

## 项目结构

```
wechat-publisher/
├── config.yaml         # 配置文件（需手动创建）
├── config.example.yaml # 配置模板
├── publish-md.ts       # 发布脚本
├── package.json        # 项目配置
├── src/                # doocs/md 核心库
│   └── doocs-md/
│       ├── core/
│       └── shared/
└── README.md           # 本文件
```

## 样式主题

默认使用 **玫瑰金** 主题：

- **H1**: 居中 + 底部玫瑰金边框
- **H2**: 居中 + 玫瑰金背景 + 白色文字
- **H3**: 左边框 + 底部虚线
- **引用块**: 斜体 + 玫瑰金左边框 + 浅灰背景
- **代码块**: GitHub Dark 主题（深色背景 + 彩色语法高亮）
- **表格表头**: 玫瑰金背景 + 白色文字
- **强调文字**: 玫瑰金 (#B76E79)

## 图片处理

工具会自动：
1. 扫描 Markdown 中的本地图片引用
2. 上传到微信公众号永久素材库
3. 替换为微信 CDN 链接

> ⚠️ 注意：图片文件名不要包含空格或特殊字符

## 依赖

- `js-yaml`: YAML 配置文件解析
- `marked`: Markdown 解析器
- `reading-time`: 阅读时间计算
- `vite-node`: TypeScript 脚本运行
- `@md/core`: 本地 doocs/md 核心库（Markdown 转 HTML）

## 更新 doocs/md 核心库

```bash
cd ~/workspace/doocs-md
git pull
pnpm install
```

## 参考

- [doocs/md](https://github.com/doocs/md) - 微信 Markdown 编辑器
- [marked](https://marked.js.org/) - Markdown 解析器
- [微信公众平台 API](https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Add_draft.html) - 草稿箱接口文档