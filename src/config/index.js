/**
 * 应用级配置。
 *
 * 安全约定：
 * - 仓库内不保存任何真实凭据，这里的 spaceId / clientSecret 均为空，需要用你自己的值；
 * - 推荐做法：用 HBuilderX 关联云服务空间，构建时由编译器注入空间配置，保持空值即可；
 * - 也可以在本机临时填写真实值调试，但不要把填写后的改动提交到 git；
 * - clientSecret 是 uniCloud 空间对客户端开放的访问凭据，会随前端包发布；
 * - 微信 AppSecret 属于服务端密钥，绝不能写入前端代码，只放在云函数环境变量中。
 */
export const CLOUD_CONFIG = {
  provider: 'aliyun',
  /** 留空则使用编译期注入的空间配置 */
  spaceId: '',
  clientSecret: '',
  endpoint: 'https://api.next.bspapp.com',
  /** 云对象名称 */
  objectName: 'baby-diary',
  /** 微信小程序需要在小程序后台把 endpoint 域名加入 request 合法域名 */
  requestDomain: 'https://api.next.bspapp.com'
};

export const APP_INFO = {
  name: '宝宝喂养日记',
  version: '1.0.0',
  slogan: '记录每一次喂养，陪宝宝慢慢长大'
};

/** 本地存储键名 */
export const STORAGE_KEYS = {
  records: 'bfd:records',
  /** 旧版单宝宝档案，迁移后仅作兼容读取 */
  baby: 'bfd:baby',
  babies: 'bfd:babies',
  currentBabyId: 'bfd:currentBabyId',
  auth: 'bfd:auth',
  family: 'bfd:family',
  /** 设备身份：微信登录不可用时（测试号 / 未配 AppSecret）用它作为身份键 */
  deviceId: 'bfd:deviceId',
  settings: 'bfd:settings',
  sync: 'bfd:sync'
};
