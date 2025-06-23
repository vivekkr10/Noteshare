// const nodemailer = require("nodemailer");
// const twilio = require("twilio");

// const sendOtp = async ({ email, phone, otp }) => {
//   if (email) {
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     const mailOptions = {
//       from: `"NoteShare" <${process.env.EMAIL_USER}>`,
//       to: email,
//       subject: "Your OTP Code",
//       html: `<h2>Your OTP is: <strong>${otp}</strong></h2>`,
//     };

//     await transporter.sendMail(mailOptions);
//   }

//   if (phone) {
//     const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
//     await client.messages.create({
//       body: `Your NoteShare OTP is ${otp}`,
//       from: process.env.TWILIO_PHONE,
//       to: phone,
//     });
//   }
// };

// module.exports = sendOtp;


const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}`
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };
