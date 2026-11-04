// ─────────────────────────────────────────────────────────────
// Quietime 静夜工作室 · 网站内容
// 改这个文件就能改网站上的文字、系列、视频和联系方式。
// 照片放在 content/photos/<系列 slug>/ 里，按文件名顺序排列。
// ─────────────────────────────────────────────────────────────

export const site = {
  name: 'Quietime',
  nameZh: '静夜工作室',
  title: 'Quietime 静夜工作室',
  description: 'Quietime 静夜工作室，摄影作品、影像与委托拍摄。',
  url: 'https://quietime.github.io/',
  statement: {
    zh: ['夜色替我们收起喧哗，', '剩下的光，才肯慢慢落进底片里。'],
    en: 'Photographs made after the noise has gone, when the light finally slows down.',
  },
  // 示例照片的来源说明。换成你自己的作品后，把 samples 改成 false。
  samples: true,
  sampleCredit: '示例影像来自 Kodak Lossless True Color Image Suite（Kodak PhotoCD PCD0992），Eastman Kodak 公开发布，作品整理完成后替换。',
  edgeCode: 'QUIETIME 400',
};

export const contact = {
  wechat: 'JYGZS2006',
  email: 'quietime@foxmail.qq.com',
  copyright: 'Copyright © Quietime Photography. All rights reserved.',
};

// 社交平台：填上链接就会显示，留空就不显示。
export const socials = [
  { name: 'Bilibili', label: 'B站', url: '' },
  { name: 'Xiaohongshu', label: '小红书', url: '' },
  { name: 'Weibo', label: '微博', url: '' },
  { name: 'Douyin', label: '抖音', url: '' },
  { name: 'Instagram', label: 'Instagram', url: '' },
];

// 照片排法：wide 宽幅，right 偏右单张，left 偏左单张，pair 与下一张并排，small 小图配文字
export const series = [
  {
    slug: 'between-tides',
    zh: '潮汐之间',
    en: 'Between Tides',
    statement: {
      zh: '海并不总是在涨落。有些下午，它只是把船轻轻放回原处，让风替人说话。这一组画格记下的，是涨潮与退潮之间那一小段迟疑。',
      en: 'The sea does not always rise or fall. Some afternoons it simply leaves the boat where it was and lets the wind do the talking. These frames keep the short hesitation between two tides.',
    },
    meta: [
      ['画格', '6'],
      ['介质', '彩色负片扫描'],
      ['来源', 'Kodak PhotoCD 示例'],
    ],
    frames: [
      { caption: '远处的岛把云托住', layout: 'wide' },
      { caption: '没有人催促的船', layout: 'right' },
      { caption: '旧码头还记得重量', layout: 'left' },
      { caption: '浅水里的两个人', layout: 'small' },
      { caption: '帆在远处排队', layout: 'pair' },
      { caption: '风终于到了', layout: 'pair' },
    ],
  },
  {
    slug: 'night-keepers',
    zh: '守夜的灯',
    en: 'Keepers of the Light',
    statement: {
      zh: '灯塔白天什么也不做，只是站着。它的意义要等到夜里才被看见，像许多安静的人。',
      en: 'A lighthouse does nothing all day except stand there. Its meaning arrives only at night, like many quiet people.',
    },
    meta: [
      ['画格', '4'],
      ['介质', '彩色负片扫描'],
      ['来源', 'Kodak PhotoCD 示例'],
    ],
    frames: [
      { caption: '礁石上的白塔', layout: 'wide' },
      { caption: '篱笆后面的守望', layout: 'small' },
      { caption: '红房子在水里又盖了一遍', layout: 'right' },
      { caption: '山水流过的地方', layout: 'left' },
    ],
  },
  {
    slug: 'old-walls',
    zh: '旧墙记',
    en: 'Notes on Old Walls',
    statement: {
      zh: '墙不会说话，但会褪色。红漆一层盖过一层，像一个家族反复写下同一个名字。',
      en: 'Walls do not speak but they do fade. Red paint over red paint, like a family writing the same name again and again.',
    },
    meta: [
      ['画格', '7'],
      ['介质', '彩色负片扫描'],
      ['来源', 'Kodak PhotoCD 示例'],
    ],
    frames: [
      { caption: '十二扇红窗', layout: 'wide' },
      { caption: '一朵花替窗户开着', layout: 'right' },
      { caption: '门闩停在中午', layout: 'pair' },
      { caption: '屋檐挨着屋檐', layout: 'pair' },
      { caption: '画在墙上的另一座房子', layout: 'left' },
      { caption: '晾在阳光里的颜色', layout: 'right' },
      { caption: '石像也在等人', layout: 'small' },
    ],
  },
];

// B站视频：填 bvid（例如 BV1xx411c7mD）就能播放；留空显示“整理中”。
// still 用某个系列的某一格做封面：'系列slug/序号'
export const films = [
  { bvid: '', zh: '一卷胶片的一天', en: 'A Day with One Roll', kind: '短片', still: 'between-tides/2' },
  { bvid: '', zh: '暗房笔记', en: 'Darkroom Notes', kind: '幕后', still: 'old-walls/3' },
  { bvid: '', zh: '等灯亮起来', en: 'Waiting for the Lamp', kind: 'Vlog', still: 'night-keepers/1' },
];

export const about = {
  intro: [
    'Quietime 静夜工作室相信，好的照片多半不是抓住的，而是等来的。我们习惯在人声退去之后才开始工作，给光一点时间，也给被拍的人一点时间。',
    '工作室承接人像、空间与品牌委托，也持续进行自己的长期系列。每一次拍摄，我们都希望留下的不只是好看的画面，还有那一刻真实的温度。',
  ],
  services: [
    ['人像与家庭', '在熟悉的地方慢慢拍，不赶时间。'],
    ['空间与建筑', '记录一个地方在不同光线里的样子。'],
    ['品牌与商业', '为产品和团队拍摄有呼吸感的画面。'],
    ['授权与展览', '作品授权、画册与展览合作。'],
  ],
};
