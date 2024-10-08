export const invoiceTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Livvic:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,900&display=swap"
      rel="stylesheet"
    />
    <title>Invoice</title>
    <style>
      @font-face {
        font-family: tannimbus;
        src: url("../../public/fonts/TAN-NIMBUS.ttf");
      }
      body {
        font-family: "Livvic", sans-serif;
        background-color: #f3f4f6;
        padding: 0;
        margin: 0;
      }
      table {
        width: 100%;
        border-spacing: 0;
      }
      .relative {
        position: relative;
      }
      .container {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        background-color: white;
        border-radius: 8px;
      }

      .bg-gray-100 {
        background-color: #f3f4f6;
      }

      .container {
        width: 100%;
        max-width: 860px; /* Approximating Tailwind's container size */
      }

      .bg-white {
        background-color: white; /* bg-white */
      }

      .shadow-lg {
        box-shadow:
          0 10px 15px rgba(0, 0, 0, 0.1),
          0 4px 6px rgba(0, 0, 0, 0.1); /* shadow-lg */
      }

      .mx-auto {
        margin-left: auto; /* mx-auto */
        margin-right: auto; /* mx-auto */
      }

      .my-8 {
        margin-top: 2rem; /* my-8 */
        margin-bottom: 2rem; /* my-8 */
      }

      .p-6 {
        padding: 1.5rem; /* p-6 */
      }

      .rounded-lg {
        border-radius: 0.5rem; /* rounded-lg */
      }

      .p-4 {
        padding: 1rem; /* p-4 */
      }

      .pl-2 {
        padding-left: 2rem;
      }

      .text-center {
        text-align: center; /* text-center */
      }

      .text-end {
        text-align: end; /* text-center */
      }

      .bg-blue-500 {
        background-color: #3b82f6; /* bg-blue-500 */
      }

      .rounded-t-lg {
        border-top-left-radius: 0.5rem; /* rounded-t-lg */
        border-top-right-radius: 0.5rem; /* rounded-t-lg */
      }

      .text-2xl {
        font-size: 1.5rem; /* text-2xl (24px) */
        line-height: 2rem; /* default Tailwind line height for 2xl */
      }

      .text-white {
        color: white; /* text-white */
      }

      .font-bold {
        font-weight: 700; /* font-bold */
      }

      .text-gray-700 {
        color: #374151; /* text-gray-700 */
      }

      .text-lg {
        font-size: 1.125rem; /* text-lg (18px) */
        line-height: 1.75rem; /* default Tailwind line height for lg */
      }

      .text-gray-600 {
        color: #4b5563; /* text-gray-600 */
      }

      .mt-4 {
        margin-top: 1rem; /* mt-4 (16px) */
      }

      .min-w-full {
        min-width: 100%; /* min-w-full */
      }

      .mt-6 {
        margin-top: 1.5rem; /* mt-6 (24px) */
      }

      .bg-gray-200 {
        background-color: #e5e7eb; /* bg-gray-200 */
      }

      .text-left {
        text-align: left; /* text-left */
      }

      .p-2 {
        padding: 0.5rem; /* p-2 (8px) */
      }

      .text-gray-600 {
        color: #4b5563; /* text-gray-600 */
      }

      .border-t {
        border-top-width: 1px; /* border-t */
        border-top-style: solid; /* border-t default style */
        border-top-color: currentColor; /* Uses current text color */
      }

      .bg-gray-200 {
        background-color: #e5e7eb; /* bg-gray-200 */
      }

      .p-2 {
        padding: 0.5rem; /* p-2 (8px) */
      }

      .text-gray-700 {
        color: #374151; /* text-gray-700 */
      }

      .font-bold {
        font-weight: 700; /* font-bold */
      }

      .text-right {
        text-align: right; /* text-right */
      }

      .bg-gray-100 {
        background-color: #f3f4f6; /* bg-gray-100 */
      }

      .text-center {
        text-align: center; /* text-center */
      }

      .p-4 {
        padding: 1rem; /* p-4 (16px) */
      }

      .rounded-b-lg {
        border-bottom-left-radius: 0.5rem; /* rounded-b-lg */
        border-bottom-right-radius: 0.5rem; /* rounded-b-lg */
      }

      .text-gray-500 {
        color: #6b7280; /* text-gray-500 */
      }

      .text-sm {
        font-size: 0.875rem; /* text-sm (14px) */
        line-height: 1.25rem; /* default line height for sm */
      }

      .bg-red-500 {
        background-color: #ef4444; /* bg-red-500 */
      }

      .font-semibold {
        font-weight: 600; /* font-semibold */
      }

      .relative {
        position: relative; /* relative */
      }

      .overflow-x-auto {
        overflow-x: auto; /* overflow-x-auto */
      }

      .w-full {
        width: 100%; /* w-full */
      }

      .text-sm {
        font-size: 0.875rem; /* text-sm (14px) */
        line-height: 1.25rem; /* default line height for sm */
      }

      .text-left {
        text-align: left; /* text-left */
      }

      .text-right {
        text-align: right; /* text-right */
      }

      .text-gray-500 {
        color: #6b7280; /* text-gray-500 */
      }

      .text-xs {
        font-size: 0.75rem; /* text-xs (12px) */
        line-height: 1rem; /* default line height for xs */
      }

      .text-gray-700 {
        color: #374151; /* text-gray-700 */
      }

      .uppercase {
        text-transform: uppercase; /* uppercase */
      }

      .bg-gray-50 {
        background-color: #f9fafb; /* bg-gray-50 */
      }

      .bg-white {
        background-color: white; /* bg-white */
      }

      .border-b {
        border-bottom-width: 1px; /* border-b */
        border-bottom-style: solid; /* default border style */
        border-bottom-color: currentColor; /* uses current text color */
      }

      .border-b-2 {
        border-bottom-width: 2px; /* border-b */
        border-bottom-style: solid; /* default border style */
        border-bottom-color: currentColor; /* uses current text color */
      }

      .px-6 {
        padding-left: 1.5rem; /* padding-left (24px) */
        padding-right: 1.5rem; /* padding-right (24px) */
      }

      .py-3 {
        padding-top: 0.75rem; /* padding-top (12px) */
        padding-bottom: 0.75rem; /* padding-bottom (12px) */
      }

      .py-4 {
        padding-top: 1rem; /* padding-top (16px) */
        padding-bottom: 1rem; /* padding-bottom (16px) */
      }

      .font-medium {
        font-weight: 500; /* font-medium */
      }

      .text-gray-900 {
        color: #111827; /* text-gray-900 */
      }

      .whitespace-nowrap {
        white-space: nowrap; /* whitespace-nowrap */
      }

      .shadow-md {
        box-shadow:
          0 4px 6px rgba(0, 0, 0, 0.1),
          0 1px 3px rgba(0, 0, 0, 0.1); /* shadow-md */
      }

      .bg-gray-800 {
        background-color: #1f2937; /* bg-gray-800 */
      }

      .leading-0-6 {
        line-height: 0.6; /* leading-[0.6] */
      }

      .mb-10 {
        margin-bottom: 2.5rem; /* mb-10 (40px) */
      }

      .mb-5 {
        margin-bottom: 1.25rem; /* mb-5 (20px) */
      }

      .whitespace-nowrap {
        white-space: nowrap;
      }
      .sub-container {
        width: 80%;
        margin: 0 auto;
      }

      tbody td {
        padding: 8px;
        border-bottom: 1px solid #ddd;
      }

      tfoot {
        margin-top: 40px; /* Adds space above the footer */
      }

      tfoot td {
        padding: 8px;
        border-bottom: none;
      }

      tfoot .title {
        font-weight: bold;
        padding-right: 45px;
      }

      tfoot .pr-45 {
        padding-right: 45px;
      }

      tfoot .text-right {
        text-align: right;
      }

      tfoot .total-row {
        background-color: red;
        color: white;
        position: absolute;
        left: 41%;
        width: 100%;
        padding-left: 18px;
      }

      tfoot .total-label {
        padding-right: 20px;
      }

      tfoot .total-amount {
        font-size: 1.5em;
        padding: 10px 68px;
      }

      .footer-section {
        margin-top: 40px;
      }

      .payment-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .thank-you h1 {
        font-family: "Cursive", sans-serif;
        font-size: 48px;
        margin: 0;
      }

      .payment-info {
        max-width: 205px;
      }

      .payment-info h2 {
        font-weight: bold;
        font-size: 18px;
        margin-bottom: 5px;
      }

      .payment-info p {
        margin: 5px 0;
      }

      .company-info .company-title {
        font-family: tannimbus, sans-serif;
        font-weight: bold;
        font-size: 17px;
        text-align: end;
      }

      .company-info p {
        font-size: 16px;
        margin-top: 5px;
        text-align: end;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .footer-section {
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .thank-you,
        .payment-info,
        .company-info {
          margin-bottom: 20px;
        }
      }
      .overflow-hidden {
        overflow: hidden;
      }
    </style>
  </head>
  <body class="bg-gray-100 p-4">
    <!-- Main Container -->
    <table class="container overflow-hidden">
      <tr>
        <td style="border-bottom: none" class="p-4">
          <div class="sub-container" style="display: flex; align-items: center; justify-content: space-between">
            <div>
              <img
                src="https://stampezee-s3.s3.ap-south-1.amazonaws.com/default/logo.png"
                width="150"
                alt="Cyber Kitty"
                style="margin-bottom: 15px"
              />
            </div>
            <h1 style="font-family: tannimbus; font-size: 40px; font-weight: bold">Invoice</h1>
          </div>
        </td>
      </tr>

      <tr>
        <td style="border-bottom: none" class="p-2">
          <div class="sub-container" style="display: flex; align-items: center; justify-content: space-between">
            <div style="display: flex; flex-direction: column">
              <span class="font-bold mb-3">Billed to:</span>
              <span>Estelle Darcy</span>
              <span>+123-456-7890123</span>
              <span>Anywhere St., Any City, ST 12345</span>
            </div>
            <div style="display: flex; flex-direction: column">
              <span>Invoice No. 12345</span>
              <span>26 September 2024</span>
            </div>
          </div>
        </td>
      </tr>

      <!-- Body Section -->

      <tr>
        <td style="padding-left: 10px; border-bottom: none" class="py-6">
          <!-- Invoice Table -->
          <div class="sub-container">
            <table class="w-full border-collapse border-spacing-0 relative">
              <thead>
                <tr>
                  <td class="border-b-2 py-3 border-main pb-3 text-left font-bold text-main">Item</td>
                  <td class="border-b-2 py-3 border-main pb-3 text-center font-bold text-main">Quantity</td>
                  <td class="border-b-2 py-3 border-main pb-3 text-center font-bold text-main">Unit Price</td>
                  <td class="border-b-2 py-3 border-main pb-3 text-center font-bold text-main">Total</td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="border-b py-3">Advanced Plan</td>

                  <td class="border-b py-3 text-center">1</td>

                  <td class="border-b py-3 text-center">$30.00</td>
                  <td class="border-b py-3 pr-3 text-center">$30.00</td>
                </tr>
                <!-- <tr>
                  <td class="border-b py-3">Custom Stamp Creation - Add On</td>

                  <td class="border-b py-3 text-center">1</td>

                  <td class="border-b py-3 text-center">$5.00</td>
                  <td class="border-b py-3 pr-3 text-center">$5.00</td>
                </tr>

                <tr>
                  <td class="border-b py-3">Push Notification - Add on</td>

                  <td class="border-b py-3 text-center">2</td>

                  <td class="border-b py-3 text-center">$5.00</td>
                  <td class="border-b py-3 text-center">$10.00</td>
                </tr> -->
              </tbody>
              <div style="margin-top: 25px"></div>
              <!-- Footer Section -->
              <tfoot>
                <tr>
                  <td></td>
                </tr>
                <tr>
                  <td style="padding-left: 287px" colspan="3" class="title">Subtotal</td>
                  <td class="text-right pr-45">$30.00</td>
                </tr>
                <tr>
                  <td style="padding-left: 287px" colspan="3" class="title">Remaining Amount</td>
                  <td class="text-right pr-45">($5.00)</td>
                </tr>
                <tr>
                  <td style="padding-left: 287px" colspan="3" class="title">Plan Change Cost</td>
                  <td class="text-right pr-45">$1.00</td>
                </tr>
                <tr>
                  <td style="padding-left: 287px" colspan="3" class="title">Coupon (10%)</td>
                  <td class="text-right pr-45">($3.00)</td>
                </tr>
                <tr>
                  <td style="padding-left: 287px" colspan="3" class="title">Tax (2%)</td>
                  <td class="text-right pr-45">$0.60</td>
                </tr>
                <tr>
                  <td></td>
                </tr>
                <tr class="total-row">
                  <td
                    colspan="3"
                    style="font-weight: 700; font-size: x-large"
                    colspan="3"
                    class="text-right total-label title"
                  >
                    Total
                  </td>
                  <td colspan="3" style="font-weight: 700; font-size: x-large" class="total-amount text-right">
                    $24.44
                  </td>
                </tr>
                <tr>
                  <td></td>
                </tr>
                <tr>
                  <td></td>
                </tr>
                <tr>
                  <td colspan="3">
                    <div style="padding-top: 40px">
                      <img src="/public/images/thank-you.jpg" width="250" alt="thank-you" style="margin-bottom: 15px" />
                    </div>
                  </td>
                </tr>
                <tr style="width: 100%">
                  <td colspan="2">
                    <div class="payment-info">
                      <h2>Payment Information</h2>
                      <p>Fauget Bank</p>
                      <p>Account Name: Juliana Silva</p>
                      <p>Account No: 123-456-7890</p>
                      <p>Pay by: 10 July 2025</p>
                    </div>
                  </td>
                  <td colspan="2">
                    <div class="company-info">
                      <h2 class="company-title">StampEzee</h2>
                      <p>123 Anywhere St., Any City, ST 12345</p>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
