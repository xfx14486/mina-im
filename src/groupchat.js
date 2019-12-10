"use strict";

import Backoff from "backo2";
import EventEmitter from "eventemitter3";

// 最大实时消息监听数量
const MAX_WATCH_COUNT = 5000;

const defaultRealtimeOptions = {
  cache: false,
  maxWatchCount: 3000,
  cloudFunctionName: "groupchat",
  collectionName: "groupchat",
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5
};

class GroupChat extends EventEmitter {
  constructor(groupId, options) {
    super();
    this._setOptions(options);

    if (!this.options.collectionName) {
      throw new Error("options.collectionName is undefined");
    }

    this.db = wx.cloud.database();
    this.collection = this.db.collection(this.options.collectionName);

    // (房间、频道) id
    this.channel = groupId;

    this.watcher = null;
    this.messages = [];
    this.connecting = false;
    this.hasHistory = true;

    this._destoryed = false;
    this._latestMessage = null;
    this._firstMesssage = null;
    this._rtimer = null;
  }

  connect() {
    this._checkDestory();
    if (this.watcher) {
      return console.warn("watch exist");
    }

    if (this.connecting) {
      return console.warn("connecting...");
    }

    let now = new Date();
    if (this._latestMessage) {
      now = new Date(this._latestMessage.createAt);
    }

    console.log(
      "start init watcher...",
      this.channel,
      now,
      this.backoff.attempts
    );
    this.connecting = true;

    this.watcher = this.collection
      .where({
        cid: this.channel,
        createAt: this.db.command.gt(now)
      })
      .watch({
        onChange: snapshot => {
          if (snapshot.type === "init") {
            this.connecting = false;
            this.backoff.reset();
            this.emit("init", snapshot);
            console.log("watcher inited");
          }

          const addMessages = [];
          const removeMessages = [];

          snapshot.docChanges.forEach(changeEvent => {
            if (changeEvent.doc.cid !== this.channel) {
              return;
            }

            switch (changeEvent.dataType) {
              case "init":
                addMessages.push(changeEvent.doc);
                break;
              case "add":
                addMessages.push(changeEvent.doc);
                break;
              case "remove":
                removeMessages.push(changeEvent.doc);
                break;
              default:
                console.warn(`${changeEvent.dataType} message not support`);
            }
          });

          if (addMessages.length > 0) {
            this._latestMessage = addMessages[0];
            if (this.options.cache) {
              this._cache(addMessages, "unshift");
            }

            this.emit("message_add", addMessages);
          }

          if (removeMessages.length > 0) {
            if (this.options.cache) {
              this._cache(removeMessages, "remove");
            }

            this.emit("message_remove", removeMessages);
          }

          if (snapshot.docs.length >= this.options.maxWatchCount) {
            console.warn(
              `reach max watch count ${this.options.maxWatchCount}, start rewatch...`
            );
            this.disconnect();
            this.connect();
          }
        },
        onError: err => {
          console.error("watch disconnect with error", err);
          this.disconnect();
          if (
            this.options.reconnection &&
            this.backoff.attempts < this.options.reconnectionAttempts
          ) {
            console.error("start reconnect...");
            this._rtimer = setTimeout(() => {
              this.connect();
            }, this.backoff.duration());
          } else {
            this.backoff.reset();
            this.connecting = false;
            this.emit("error", err);
          }
        }
      });
  }

  disconnect() {
    this._checkDestory();
    if (!this.watcher) {
      return;
    }

    clearTimeout(this._rtimer);
    this._lastConnectTime = new Date();
    this.watcher.close();
    this.watcher = null;
    console.log("watcher disconnect");
  }

  destory() {
    if (this._destoryed) {
      return;
    }

    this.disconnect();
    this.removeAllListeners();
    this._destoryed = true;
    this.db = null;
    this.collection = null;
    this.messages = [];
    this.connecting = false;
    this.hasHistory = true;
    this._latestMessage = null;
    this._firstMesssage = null;
    this._rtimer = null;
    console.log("watcher destoryed");
  }

  send(data) {
    this._checkDestory();

    data.cid = this.channel;

    return wx.cloud
      .callFunction({
        name: this.options.cloudFunctionName,
        data: {
          type: "add_message",
          data
        }
      })
      .then(resp => {
        if (resp.result.error) {
          throw new Error(resp.result.error);
        }

        return resp;
      });
  }

  loadHistory(count = 20, time) {
    this._checkDestory();
    if (!this.hasHistory) {
      console.warn("all history loaded");
      return [];
    }

    if (this.historyloading) {
      console.warn("history loading...");
      return [];
    }

    let date = new Date();
    if (this._firstMesssage) {
      date = new Date(this._firstMesssage.createAt);
    }

    if (time) {
      date = new Date(time);
    }

    this.historyloading = true;
    return this.collection
      .orderBy("createAt", "desc")
      .where({
        cid: this.channel,
        createAt: this.db.command.lte(date)
      })
      .limit(count)
      .get()
      .then(resp => {
        this.historyloading = false;
        if (resp.data.length < count) {
          this.hasHistory = false;
        }

        if (resp.data[0]) {
          this._firstMesssage = resp.data[resp.data.length - 1];
        }

        if (this.options.cache) {
          this._cache(resp.data, "append");
        }

        this.emit("history", resp.data);
        return resp.data;
      })
      .finally(() => {
        this.historyloading = false;
      });
  }

  countMessageBefore(time) {
    this.collection
      .orderBy("createAt", "desc")
      .where({
        createAt: this.db.command.lte(time),
        cid: this.channel
      })
      .count()
      .then(res => {
        return res.total;
      });
  }

  _cache(data, type) {
    if (type === "append") {
      this.messages = this.messages.concat(data);
      return;
    }

    if (type === "unshift") {
      this.messages = data.concat(this.messages);
      return;
    }

    if (type === "remove") {
      data.forEach(msg => {
        const index = this._searchMessageIndex(msg);
        if (index > -1) {
          this.messages.splice(index, 1);
        }
      });
    }
  }

  _searchMessageIndex(value) {
    const list = this.messages;
    let start = 0;
    let stop = list.length - 1;
    let middle = Math.floor((start + stop) / 2);

    function compare(a, b) {
      if (a._id === b._id) {
        return 0;
      }

      return a.createAt - b.createAt;
    }

    if (list.length === 0) {
      return -1;
    }

    while (compare(list[middle], value) !== 0 && start < stop) {
      if (compare(list[middle], value) > 0) {
        stop = middle - 1;
      } else {
        start = middle + 1;
      }

      middle = Math.floor((start + stop) / 2);
    }

    const order = compare(list[middle], value);

    if (order !== 0) {
      return -1;
    }

    return middle;
  }

  _setOptions(options = {}) {
    options = Object.assign(
      {},
      this.options || defaultRealtimeOptions,
      options
    );

    if (options.maxWatchCount > MAX_WATCH_COUNT) {
      console.warn(
        `setOptions() fail, options.maxWatchCount should less then ${MAX_WATCH_COUNT}, more info: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database/realtime.html`
      );
      options.maxWatchCount = MAX_WATCH_COUNT;
    }

    this.backoff = new Backoff({
      min: options.reconnectionDelay,
      max: options.reconnectionDelayMax,
      jitter: options.randomizationFactor
    });

    this.options = options;
  }

  _checkDestory() {
    if (this._destoryed) {
      throw new Error(`${this.channel} destoryed`);
    }
  }
}

export default GroupChat;
