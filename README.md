# 宝宝喂养日记 · Baby Feeding Diary

一个面向新手爸妈的微信小程序：把宝宝一天里「吃了什么、睡了多久、拉了什么、有没有发烧」用最少的手势记录下来，并自动汇总成可回看的成长轨迹。

技术栈：**uni-app (Vue 3 + Vite) + Vant Weapp + uniCloud（阿里云）**，目标平台为微信小程序。仓库内不包含任何个人凭据，AppID / 服务空间等均为占位值，使用前需替换成你自己的（见第三节）。

---

## 一、功能设计

### 1. 九类可记录事件

| 类型     | 记录内容                                            | 设计要点                                     |
| -------- | --------------------------------------------------- | -------------------------------------------- |
| 喂养     | 亲喂（左/右/双侧 + 时长）、瓶喂母乳、配方奶（奶量） | 首页显示「距上次喂养」倒计时与建议间隔进度条 |
| 换尿布   | 尿 / 便 / 尿+便，便便颜色与性状                     | 颜色、性状选项覆盖新生儿常见异常提示场景     |
| 睡眠     | 入睡时间 + 睡眠时长 + 安稳度                        | 补录历史时可直接改时间，不必计时             |
| 身高体重 | 身高、体重、头围                                    | 三项均可选填，至少填一项                     |
| 体温     | 数值 + 测量方式（腋/耳/额/肛）                      | ≥37.5℃ 在统计页高亮并标记「偏高」            |
| 用药     | 药名、剂量、单位、给药途径                          | 便于复诊时向医生复述用药史                   |
| 黄疸     | 经皮胆红素值 + 单位 + 测量部位                      | 支持 mg/dL 与 μmol/L 两种单位                |
| 补剂     | 维生素 D/AD、益生菌、铁剂等 + 剂量                  | 每天固定项目可快速录入                       |
| 辅食     | 食物、份量、接受度、是否首次尝试                    | 「首次尝试」用于过敏观察标记                 |

### 2. 页面

- **今日**：喂养节奏卡（距上次喂养 / 建议间隔进度）、今日四项指标、九宫格快捷记录、今日时间轴。
- **记录**：按日期翻阅（可回看任意一天），支持按类型筛选，顶部显示当日各类事件计数。
- **统计**：近 7 天 / 近 30 天维度，喂养次数、瓶喂奶量、睡眠时长、尿布次数柱状图；身高体重与体温历史列表。
- **我的**：宝宝档案、云同步、喂养间隔设置、导出数据、清空本地记录。

### 3. 数据策略

**本地优先，云端增量同步**：

1. 所有写操作先落 `uni.setStorageSync`，断网也能记；
2. 写入后若已开启同步，静默推送到 uniCloud 云对象，失败不影响本地；
3. 云端通过 6 位「同步码」隔离不同家庭的数据，换手机输入同一同步码即可接续；
4. 删除采用软删除（墓碑），保证多端删除状态一致。

---

## 二、技术选型说明

### 为什么用 Vant Weapp 而不是 Vant 4

Vant 4 是面向 H5 的 Vue 3 组件库，依赖真实 DOM，**无法在微信小程序自定义组件环境运行**。Vant 官方为此提供了小程序版本 **Vant Weapp**（`@vant/weapp`），两者共用同一套设计语言与主题变量。

本项目通过 `scripts/copy-vant.js` 把用到的 Vant Weapp 组件（button / icon / stepper / switch 及其依赖）复制到 `src/wxcomponents/@vant/weapp`，并在 `pages.json` 的 `globalStyle.usingComponents` 中注册，按需复制可把组件体积从 1.9MB 压到约 190KB。

> 新增 Vant 组件时：在 `scripts/copy-vant.js` 的 `USED_COMPONENTS` 里登记，并在 `pages.json` 的 `usingComponents` 补一行即可。

### 为什么不用 Pinia

全局状态只服务于「记录 + 档案 + 设置」三块，用 `reactive` 单例（`src/store/index.js`）配合显式 action 更轻，也避免小程序端额外的包体。

---

## 三、本地运行

### 首次运行前：替换占位配置

仓库已把个人凭据全部替换为占位值，克隆后需要改成你自己的：

| 位置                  | 字段                                | 说明                                                       |
| --------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `src/manifest.json`   | 顶层 `appid`                        | DCloud AppID，格式 `__UNI__xxxxxxx`，用 HBuilderX 重新获取 |
| `src/manifest.json`   | `mp-weixin.appid`                   | 你的微信小程序 AppID（`wx` 开头 18 位）                    |
| `src/manifest.json`   | `uniCloud.spaceId` / `clientSecret` | **建议留空**，用 HBuilderX 关联云服务空间后由编译器注入    |
| `src/config/index.js` | `spaceId` / `clientSecret`          | 同上，留空即可；本地临时调试可填真实值，但**不要提交**     |
| 云对象环境变量        | `WX_APPID` / `WX_APPSECRET`         | 只存在 uniCloud 控制台，永远不进代码仓库                   |

> 微信 AppSecret 只放在云对象环境变量中，任何情况下都不要写进 `src/` 下的文件。

```bash
npm install          # 安装依赖，postinstall 会自动复制 Vant 组件
npm run dev:mp-weixin # 开发模式，产物在 dist/dev/mp-weixin
npm run build:mp-weixin # 生产构建，产物在 dist/build/mp-weixin
```

然后用微信开发者工具「导入项目」，目录选择 `dist/dev/mp-weixin`（或 `dist/build/mp-weixin`）。

`npm install` 若提示 `esbuild` 等包未执行安装脚本，请运行 `npm install-scripts approve esbuild` 后重试。

### 浏览器里快速预览（H5）

```bash
npm run dev:h5   # http://localhost:5173
```

浏览器调试比每次开微信开发者工具快得多，适合调样式和交互逻辑。

但要注意 **H5 只用于开发预览，最终产物仍是小程序**：

- Vant Weapp 是微信原生自定义组件，浏览器无法渲染。`src/components/h5/` 下放了 `van-icon / van-button / van-stepper / van-switch` 四个等价 Vue 组件，在 `main.js` 里用 `#ifdef H5` 条件注册，**不会进入小程序包体**。
- 新增 Vant 组件时，若想在 H5 里也能看到，需要同步补一个 `src/components/h5/` 版本。
- 自定义导航栏的胶囊避让依赖 `uni.getMenuButtonBoundingClientRect()`，H5 下走默认值，位置和真机会有差异。

小程序端与 H5 端的能力差异（如原生 picker 样式、`van-stepper` 键盘交互）仍需在微信开发者工具里复核。

---

## 四、uniCloud 部署（云同步必需）

云同步能力需要一次性部署，**未部署时小程序仍可正常使用，只是数据仅存在本机**。

> 从微信「小程序测试号」换成正式小程序（含数据迁移、体验版发布）请直接看 [部署手册.md](./部署手册.md)。

1. 用 **HBuilderX** 打开本项目目录（HBuilderX 是 uniCloud 云函数的唯一发布入口）。
2. 在项目根目录的 `uniCloud-aliyun` 上右键 → **关联云服务空间**，选择你自己的服务空间（阿里云）。
3. 右键 `uniCloud-aliyun/cloudfunctions/baby-diary` → **上传部署**。
4. 右键 `uniCloud-aliyun/database` → **上传所有 DB Schema**，并执行 `db_init.json` 初始化。
   需要存在五个集合：`bdf-records`、`bdf-babies`、`bdf-members`、`bdf-families`、`bdf-invites`（schema 已把客户端直连权限全部关闭，只允许云对象访问）。
5. 微信公众平台 → 开发管理 → 开发设置 → 服务器域名，把
   `https://api.next.bspapp.com` 加入 **request 合法域名**。
6. 微信公众平台 → 开发管理 → 开发设置，把 **AppID 与 AppSecret** 配置到云对象环境变量
   `WX_APPID` / `WX_APPSECRET`（uniCloud 控制台 → 云函数 → baby-diary → 环境变量）。
   **不配也能用**：登录会自动降级为「设备身份」，只是换手机时需要重新接受邀请；
   配好后同一微信号换手机可以自动认回原身份。
   ⚠️ 微信「小程序测试号」的 AppSecret 不支持 `code2Session`（固定返回 `40125 invalid appsecret`），必须用正式小程序的凭据才能真正启用微信登录。
7. 在小程序「我的 → 家庭与成员」创建家庭，再邀请另一位微信号验证加入与权限。

> 仓库里的 `spaceId` / `clientSecret` 默认为空，用 HBuilderX 关联空间后由编译器注入。若你手动填写在 `src/config/index.js`，它属于 uniCloud 空间对客户端开放的访问凭据、会随前端包发布，注意不要把自己空间的凭据提交到公开仓库；它与微信 AppSecret 不同，不用于换取用户身份。

### 关于微信 AppSecret（重要）

微信后台生成的 AppSecret（32 位）是**服务端密钥**，一旦进入小程序包体即可被反编译获取，进而被用来伪造服务端接口调用。因此本项目：

- **没有**把 AppSecret 写进任何前端文件；
- 只在云对象 `baby-diary` 里通过 `process.env.WX_APPSECRET` 读取，用于 `jscode2session` 换 openid；
- 未配置这两个环境变量、或凭据无效时，登录自动降级为设备身份（`loginType: 'device'`），功能不受影响。

---

## 五、目录结构

```
├── scripts/
│   ├── copy-vant.js        # 按需复制 Vant Weapp 组件
│   └── gen-icons.js        # 纯 Node 生成 tabBar 图标（无图像依赖）
├── uniCloud-aliyun/
│   ├── cloudfunctions/baby-diary/index.obj.js   # 云对象：登录 / 家庭 / 成员 / 宝宝 / 同步
│   └── database/*.schema.json + db_init.json
└── src/
    ├── App.vue              # 全局样式与设计变量（Vant 主题覆盖）
    ├── pages.json           # 页面、tabBar、Vant 组件注册
    ├── config/index.js      # uniCloud 配置、存储键名
    ├── common/
    │   ├── record-schema.js # 九类记录的元数据 + 动态表单配置 + 摘要文案
    │   └── utils.js         # 日期、月龄、时长格式化
    ├── services/
    │   ├── storage.js       # 本地存储封装
    │   └── cloud.js         # 同步、增量合并、静默同步
    ├── store/index.js       # reactive 单例：记录 / 档案 / 设置 / 同步状态
    ├── components/          # chip-select、record-item、stat-tile、bar-chart
    └── pages/               # today / records / stats / mine / record-edit / baby-profile / baby-list / family / family-join / sync
```

### 数据模型

```js
{
  id: 'doc-id',            // 客户端生成的稳定 ID
  babyId: 'baby-id',       // 归属宝宝；空值视为旧数据，归到家庭第一个宝宝
  type: 'feeding',         // 九种类型之一
  time: 1730000000000,     // 发生时间（毫秒）
  payload: { mode, side, duration, amount, ... }, // 类型专属字段
  note: '',
  createdAt, updatedAt,
  deleted: false
}
```

本地 `state.records` 保存全家所有宝宝的记录，页面通过 `babyRecords()` 按 `currentBabyId` 过滤；`state.baby` 是当前宝宝快照，`switchBaby()` 时整体刷新。

冲突解决：云端合并时以 `updatedAt` 较新者为准；增量拉取用服务端 `serverUpdatedAt >= since`，避免同毫秒写入遗漏。

---

## 六、后续可扩展

- 身高体重百分位曲线（对接 WHO 生长标准表）
- 喂养/用药定时提醒（订阅消息 + 云函数定时触发器）
- 图片附件（云存储）与儿科医生分享报告
- 一个账号加入多个家庭（当前一个 openid 只属于一个家庭）
