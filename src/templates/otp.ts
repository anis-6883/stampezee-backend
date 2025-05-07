export const otpTemplate = (verificationCode: string, stampezee_header_logo: string, stampezee_footer_logo: string) => {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>StampEzee OTP Email</title>
  </head>
  <body style="margin: 0; font-family: &quot;Segoe UI&quot;, sans-serif; background: #fefefe; color: #333">
    <div style="display: none; max-height: 0; overflow: hidden">Your OTP for StampEzee registration</div>

    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="table-layout: fixed; background-color: #fefefe; width: 100%"
    >
      <tr>
        <td align="center">
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="
              max-width: 600px;
              margin: 20px auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
              overflow: hidden;
            "
          >
            <tr>
              <td style="background: #d32f2f; padding: 20px 30px; text-align: center; color: white">
                <img
                  src="cid:stampezee_header_logo"
                  alt="StampEzee Logo"
                  width="100"
                  style="margin-bottom: 10px"
                />
                <h1 style="margin: 0; font-size: 24px">Welcome to StampEzee!</h1>
                <p style="margin: 5px 0 0; font-size: 14px">Collect. Redeem. Repeat.</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px; background-color: #ffffff">
                <h2 style="margin-top: 0; font-size: 20px; color: #b71c1c">Verify Your Account</h2>
                <p style="font-size: 15px; line-height: 1.6">
                  Thank you for registering with <strong>StampEzee</strong>! To complete your registration, please use
                  the OTP below:
                </p>
                <p
                  style="
                    font-size: 24px;
                    font-weight: bold;
                    background: #ffebee;
                    color: #d32f2f;
                    padding: 12px 20px;
                    text-align: center;
                    letter-spacing: 2px;
                    border-radius: 8px;
                    margin: 20px 0;
                  "
                >
                  ${verificationCode}
                </p>
                <p style="font-size: 14px; color: #666">
                  This OTP is valid for 2 minutes. Do not share it with anyone.
                </p>
                <p style="margin-top: 30px">
                  If you did not request this OTP, please ignore this email or contact our support.
                </p>
                <p style="font-size: 14px">Warm regards,<br /><strong>– The StampEzee Team</strong></p>
              </td>
            </tr>
            <tr>
              <td style="background: #f5f5f5; text-align: center; padding: 20px; font-size: 12px; color: #888">
                <img
                  src="cid:stampezee_footer_logo"
                  alt="StampEzee Logo"
                  width="60"
                  style="margin-bottom: 8px"
                />
                <div><strong>StampEzee</strong> – Collect. Redeem. Repeat.</div>
                <div>© 2025 StampEzee | Toronto, Canada</div>
                <div style="margin-top: 5px">
                  <a href=${process.env.POLICY} style="color: #d32f2f; text-decoration: none">Privacy Policy</a> |
                  <a href=${process.env.CONTACT_URL} style="color: #d32f2f; text-decoration: none">Support</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};
