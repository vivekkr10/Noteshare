const twilio = require("twilio");
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

const sendOTPSMS = async (number, otp) => {
  await client.messages.create({
    body: `Your NoteShare OTP is: ${otp}`,
    from: process.env.TWILIO_PHONE,
    to: number
  });
};

module.exports = { sendOTPSMS };
