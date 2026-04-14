export function createFakeSmsAdapter({ userScript }) {
  let step = 0;
  return {
    name: "demo.sms",
    async execute(packet) {
      const message = packet.inputs?.message || packet.requested_action?.join(" ") || "";
      if (message) {
        console.log("\n📤 SMS → User:");
        console.log(message);
      }
      const reply = userScript[step++] || null;
      if (reply) {
        console.log("\n📥 User:");
        console.log(reply);
      }
      return {
        status: "completed",
        outcome: "succeeded",
        summary: `executed ${packet.task_id}`,
        outputs: { user_reply: reply }
      };
    }
  };
}
