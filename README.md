# mina-im

基于小程序实时数据推送的小程序即时通信 Demo

## Usage

### GroupChat

实时群聊 API，支持加载历史消息，发送消息

接入：

1. 在云开发控制台新建数据库集合 `groupchat`, 并把权限设置为所有用户可读，添加索引 `createAt`
2. 上传 `cloudfunctions/groupchat` 云函数

```js
import {GroupChat} from 'path/to/mina-im';

const chatroom = new GroupChat(roomId, {
  // 是否缓存消息，缓存的消息可以通过 chatroom.messages 获取
  cache: false,
  // 最大监听消息个数，当超过时，会进行重新监听（会断开连接）
  maxWatchCount: 3000,
  // 云函数名字
  cloudFunctionName: "groupchat",
  // 云开发数据库集合名
  collectionName: "groupchat",
  // 连接出错时是否自动重连
  reconnection: true,
  // 重连尝试次数
  reconnectionAttempts: Infinity,
  // 尝试新的重新连接之前的等待的时间（1000）。 受 randomizationFactor 影响，例如，默认的初始延迟将在 500 到 1500ms 之间。
  reconnectionDelay: 1000,
  // 重新连接之间的最长等待时间（5000）。 每次尝试都会使重新连接延迟 (reconnectionDelay) 增加2倍
  reconnectionDelayMax: 5000,
  // 0 <= randomizationFactor <= 1
  randomizationFactor: 0.5
})

// 监听连接成功
chatroom.on('init', (snapshoot) => {})

// 监听新消息
chatroom.on('message_add', (messages) => {})

// 监听消息删除
chatroom.on('message_remove', (messages) => {})

// 监听历史消息
chatroom.on('history', (messages) => {})

// 监听重连失败
chatroom.on('error', (err) => {})

// 开始监听
chatroom.connect();

// 加载历史消息
chatroom.loadHistory(20);

// 统计在 time 之前的消息数
chatroom.countMessageBefore(time);

// 发送消息
chatroom.send(message);

// 停止监听
chatroom.disconnect();

// 缓存的消息 (需要开启 options.cache)
chatroom.messages

// 是否还有更多历史消息
chatroom.hasHistory

// 是否正处于连接中
chatroom.connecting

```

## License

MIT © [alexayan](https://github.com/alexayan)
