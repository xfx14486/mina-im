const cloud = require("wx-server-sdk");

cloud.init();

const db = cloud.database();

const COLLECTION = process.env.COLLECTION;

async function checkSec(message) {
  const content = JSON.stringify(message);

  try {
    const result = await cloud.openapi.security.msgSecCheck({
      content
    });
    if (result.errCode !== 0) {
      throw new Error("含有违规内容");
    }
  } catch (e) {
    console.error(e);
    throw new Error("含有违规内容");
  }
}

exports.main = async event => {
  try {
    console.log(event);
    if (event.type === "add_message") {
      const message = event.data;
      message.createAt = db.serverDate();

      await checkSec(message);

      await db.collection(COLLECTION).add({
        data: message
      });

      return message;
    }

    throw new Error("not support");
  } catch (err) {
    console.log(err);
    return {
      error: err.message
    };
  }
};
