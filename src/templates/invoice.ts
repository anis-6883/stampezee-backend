export const invoiceTemplate = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invoice</title>
    <style>
      body {
        font-family: "Arial", sans-serif;
        background-color: #f3f4f6;
        padding: 0;
        margin: 0;
      }
      table {
        width: 100%;
        border-spacing: 0;
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
        max-width: 600px; /* Approximating Tailwind's container size */
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
    </style>
  </head>
  <body class="bg-gray-100 p-4">
    <!-- Main Container -->
    <table class="container bg-white shadow-lg mx-auto my-8 p-6 rounded-lg">
      <tr>
        <td class="p-4 text-center">
          <img
            src="https://stampezee-s3.s3.ap-south-1.amazonaws.com/default/logo.png"
            width="100"
            alt="Cyber Kitty"
            style="display: block; margin: 0 auto; margin-bottom: 15px"
          />
        </td>
      </tr>

      <tr>
        <td class="p-4 bg-black rounded-lg" style="background-color: #374151">
          <h1 class="text-2xl text-center text-white font-bold mb-10">Subscription Invoice</h1>
          <ul style="list-style-type: circle">
            <li class="text-white">
              <p class="text-base text-white leading-0-6"><span class="font-semibold">Store Name:</span> Root Drinks</p>
            </li>
            <li class="text-white">
              <p class="text-base text-white leading-0-6">
                <span class="font-semibold">Invoice Number:</span> 1E2F36AC-0001
              </p>
            </li>
            <li class="text-white">
              <p class="text-base text-white leading-0-6">
                <span class="font-semibold">Subscription ID:</span> sub_1Q55YaJVIk5LKvIEuURHa5X3
              </p>
            </li>
            <li class="text-white">
              <p class="text-base text-white leading-0-6"><span class="font-semibold">Enroll Status:</span> Purchase</p>
            </li>
            <li class="text-white">
              <p class="text-base text-white leading-0-6"><span class="font-semibold">Balance:</span> 4.5 CAD</p>
            </li>
            <li class="text-white">
              <p class="text-base text-white leading-0-6">
                <span class="font-semibold">Subscription Period:</span> Oct 01 - Oct 31
              </p>
            </li>
            <li class="text-white">
              <p class="text-base text-white leading-0-6">
                <span class="font-semibold">Purchased At:</span> 01 Oct 2024, 06:51 PM
              </p>
            </li>
          </ul>
        </td>
      </tr>

      <!-- Body Section -->
      <tr>
        <td class="p-6">
          <p class="text-gray-700 text-lg font-semibold">Hello Anisuzzaman,</p>
          <p class="text-gray-600 mt-4">Thank you for your purchase! Below is a summary of your recent order.</p>

          <!-- Invoice Table -->
          <div class="relative overflow-x-auto rounded-lg" style="border: 1px solid #e2e8f0">
            <table class="w-full text-sm text-left text-gray-500">
              <thead class="text-xs text-gray-700 uppercase" style="background-color: #374151">
                <tr>
                  <th scope="col" class="px-6 py-3 text-white whitespace-nowrap">Description</th>
                  <th scope="col" class="px-6 py-3 text-white whitespace-nowrap">Quantity</th>
                  <th scope="col" class="px-6 py-3 text-white whitespace-nowrap">Unit Price (CAD)</th>
                  <th scope="col" class="px-6 py-3 text-white text-end whitespace-nowrap">Amount (CAD)</th>
                </tr>
              </thead>
              <tbody>
                <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                  <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                    Location Based Push Notification Add-on
                  </th>
                  <td class="px-6 py-4 text-center">1</td>
                  <td class="px-6 py-4 text-end">5.00</td>
                  <td class="px-6 py-4 text-end">5.00</td>
                </tr>
                <tr class="bg-white dark:bg-gray-800">
                  <th
                    scope="row"
                    class="px-6 py-4 text-gray-900 whitespace-nowrap font-semibold"
                    style="border-bottom: 1px solid #cbd5e1"
                  >
                    Subtotal
                  </th>
                  <td class="px-6 py-4" style="border-bottom: 1px solid #cbd5e1"></td>
                  <td class="px-6 py-4" style="border-bottom: 1px solid #cbd5e1"></td>
                  <td class="px-6 py-4 text-end font-semibold" style="border-bottom: 1px solid #cbd5e1">5.00</td>
                </tr>
                <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                  <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                    VAT (2%)
                  </th>
                  <td class="px-6 py-4"></td>
                  <td class="px-6 py-4"></td>
                  <td class="px-6 py-4 text-end">0.10</td>
                </tr>
                <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                  <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                    Coupon (10%)
                  </th>
                  <td class="px-6 py-4"></td>
                  <td class="px-6 py-4"></td>
                  <td class="px-6 py-4 text-end">- 0.50</td>
                </tr>
                <tr class="bg-white dark:bg-gray-800">
                  <th scope="row" class="px-6 py-4 text-gray-900 whitespace-nowrap font-semibold">Total</th>
                  <td class="px-6 py-4"></td>
                  <td class="px-6 py-4"></td>
                  <td class="px-6 py-4 text-end font-semibold">$4.60</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="text-gray-600 mt-6">
            If you have any questions regarding your order, feel free to contact us. Thank you for choosing us!
          </p>

          <p class="text-gray-700 mt-6"><span class="font-semibold">Best regards,</span></p>
          <p class="text-base leading-0-6">StampEzee Team</p>
        </td>
      </tr>

      <!-- Footer Section -->
      <tr>
        <td class="bg-gray-100 text-center p-4 rounded-lg">
          <p class="text-gray-500 text-sm">
            &copy; 2024 StampEzee | All rights reserved.
            <br />
            <br />
            NexGen Mobility<br />
            International FZE<br />
            Bosco Edwin
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
