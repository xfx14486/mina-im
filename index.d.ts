interface Options {
  retry?: number, // 连接重试次数
  watchCount?: number, // 最大实时消息监听数量
  cloudFunction?: string, // 云函数名字
  watchUser?: boolean, // 是否启用监听实时用户数据 (最近 userActiveTime 内活跃用户)
  userActiveInterval?: number, // 活跃检测时间
  userActiveRange?: number // 活跃用户时间段
}

interface User {
  uid: string
}

interface Message {
  tags: string[];
}

interface MessageOpt {
  containTags(doc: Message, tags: string[]): Promise<any>

  changeTags(doc: Message, addTags: string[], removeTags: string[]): Promise<any>

  updateMessage(doc: Message, data: any): Promise<any>

  addMessage(data: any): Promise<any>

  liveUser(): Promise<any>

  unliveUser(): Promise<any>
}

declare class Realtime {
  constructor(collection: string, channel: string, options: Options)
  setOptions(options: Options): void
  setCurrentUser(user: User): void
  connect(slient: boolean): void
  disconnect(silent: boolean): void
  destory(): void
  sendMessage(message: Message): Promise<any>
  loadHistory(count: number, filter: Object)
  live(): void
  unlive(): void
  mergeTags(tags: string[], addTags: string[], removeTags: string[])
  on(event: string, callback: () => {}): void
  off(event: string, callback: () => {}): void
  emit(event: string, args: any): void

  collection: any
  channel: any
  users: User[]
  TAGS: {
    USER: string,
    DEFAULT: string,
    GLOBAL: string,
    SECURITY: string,
    USER_LIVE: string,
    REMOVE: string
  }
  watcher: any
  Message: MessageOpt
  options: Options
}

export as namespace Chatroom;

export default Realtime;
