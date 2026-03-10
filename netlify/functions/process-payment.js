const ApiContracts = require('authorizenet').APIContracts;
const ApiControllers = require('authorizenet').APIControllers;
const SDKConstants = require('authorizenet').Constants;

const PRODUCTS = {
  system: {
    name: 'Princeton Offense System',
    price: 39.00,
    downloads: [
      { label: '87-Page Princeton Offense Playbook (PDF)', url: 'https://coachprincetonbasketball.com/files/princeton-offense-playbook.pdf' },
      { label: 'Learn the Princeton Video Walkthrough', url: 'https://youtu.be/oik75ML4kp0' },
      { label: 'Practice Plans & Drills Guide (PDF)', url: 'https://coachprincetonbasketball.com/files/practice-plans-drills.pdf' }
    ]
  },
  bundle: {
    name: 'Complete Coaching Bundle',
    price: 49.00,
    downloads: [
      { label: '87-Page Princeton Offense Playbook (PDF)', url: 'https://coachprincetonbasketball.com/files/princeton-offense-playbook.pdf' },
      { label: 'Learn the Princeton Video Walkthrough', url: 'https://youtu.be/oik75ML4kp0' },
      { label: 'Practice Plans & Drills Guide (PDF)', url: 'https://coachprincetonbasketball.com/files/practice-plans-drills.pdf' },
      { label: 'West Virginia 2-Guard Offense Playbook (PDF)', url: 'https://coachprincetonbasketball.com/files/wv-2guard-offense.pdf' }
    ]
  }
};

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { opaqueData, product, amount, customerName, customerEmail } = JSON.parse(event.body);

    if (!opaqueData || !product || !amount || !customerName || !customerEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const productInfo = PRODUCTS[product];
    if (!productInfo) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid product' }) };
    }

    // Build Authorize.net transaction request
    const merchantAuth = new ApiContracts.MerchantAuthenticationType();
    merchantAuth.setName(process.env.AUTHNET_API_LOGIN_ID);
    merchantAuth.setTransactionKey(process.env.AUTHNET_TRANSACTION_KEY);

    const opaqueDataType = new ApiContracts.OpaqueDataType();
    opaqueDataType.setDataDescriptor(opaqueData.dataDescriptor);
    opaqueDataType.setDataValue(opaqueData.dataValue);

    const paymentType = new ApiContracts.PaymentType();
    paymentType.setOpaqueData(opaqueDataType);

    const customerDataType = new ApiContracts.CustomerDataType();
    customerDataType.setEmail(customerEmail);

    const order = new ApiContracts.OrderType();
    order.setDescription(productInfo.name);

    const nameParts = customerName.trim().split(' ');
    const billTo = new ApiContracts.CustomerAddressType();
    billTo.setFirstName(nameParts[0] || 'Customer');
    billTo.setLastName(nameParts.slice(1).join(' ') || 'Customer');

    const transactionRequest = new ApiContracts.TransactionRequestType();
    transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount(parseFloat(amount).toFixed(2));
    transactionRequest.setCustomer(customerDataType);
    transactionRequest.setOrder(order);
    transactionRequest.setBillTo(billTo);

    // Enable test mode via env var (for smoke testing — remove after verifying happy path)
    if (process.env.AUTHNET_TEST_MODE === 'true') {
      const settingList = new ApiContracts.ArrayOfSetting();
      const testSetting = new ApiContracts.SettingType();
      testSetting.setSettingName('testRequest');
      testSetting.setSettingValue('true');
      settingList.setSetting([testSetting]);
      transactionRequest.setTransactionSettings(settingList);
      console.log('AUTHNET_TEST_MODE enabled — transaction will not be charged');
    }

    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequest);

    const controller = new ApiControllers.CreateTransactionController(createRequest.getJSON());
    controller.setEnvironment(SDKConstants.endpoint.production);

    const result = await new Promise((resolve, reject) => {
      controller.execute(() => {
        try {
          const apiResponse = controller.getResponse();
          const response = new ApiContracts.CreateTransactionResponse(apiResponse);
          resolve(response);
        } catch (e) {
          reject(e);
        }
      });
    });

    const txnResponse = result.getTransactionResponse();

    if (!txnResponse || result.getMessages().getResultCode() !== ApiContracts.MessageTypeEnum.OK) {
      const errorMsg =
        txnResponse?.getErrors()?.getError()?.[0]?.getErrorText() ||
        result.getMessages().getMessage()[0].getText() ||
        'Transaction declined';
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: errorMsg }) };
    }

    if (txnResponse.getResponseCode() !== '1') {
      const errorText =
        txnResponse.getErrors()?.getError()?.[0]?.getErrorText() ||
        txnResponse.getMessages()?.getMessage()?.[0]?.getDescription() ||
        'Transaction declined';
      const errorCode =
        txnResponse.getErrors()?.getError()?.[0]?.getErrorCode() || txnResponse.getResponseCode();
      console.error('Authnet decline:', errorCode, errorText, 'authCode:', txnResponse.getAuthCode());
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: errorText }) };
    }

    const transactionId = txnResponse.getTransId();

    // Send delivery email via Resend
    await sendDeliveryEmail({ customerName, customerEmail, productInfo, transactionId });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, transactionId })
    };

  } catch (err) {
    console.error('process-payment error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Server error. Please try again.' })
    };
  }
};

async function sendDeliveryEmail({ customerName, customerEmail, productInfo, transactionId }) {
  const downloadLinks = productInfo.downloads.map(d =>
    `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;">
        <a href="${d.url}" style="color:#c9a84c;font-weight:600;text-decoration:none;font-size:15px;">${d.label}</a>
      </td>
    </tr>`
  ).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#0d1117;padding:32px 24px;text-align:center;">
        <h1 style="color:#c9a84c;margin:0;font-size:24px;letter-spacing:1px;">Coach Princeton Basketball</h1>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="color:#1a1a1a;margin-top:0;">You're in. Here are your download links.</h2>
        <p style="color:#333;font-size:15px;">Hi ${customerName},</p>
        <p style="color:#333;font-size:15px;">Your purchase of the <strong>${productInfo.name}</strong> is confirmed. Click any link below to access your materials — these links never expire.</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;margin:24px 0;">
          <thead>
            <tr style="background:#f8f8f8;">
              <th style="padding:12px 16px;text-align:left;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Your Files &amp; Resources</th>
            </tr>
          </thead>
          <tbody>
            ${downloadLinks}
          </tbody>
        </table>
        <p style="color:#666;font-size:14px;line-height:1.6;">
          <strong>Order #:</strong> ${transactionId}<br>
          Save this email for future access to your materials.
        </p>
        <p style="color:#333;font-size:15px;">
          Questions? Email us at <a href="mailto:support@coachprincetonbasketball.com" style="color:#c9a84c;">support@coachprincetonbasketball.com</a>
        </p>
      </div>
      <div style="background:#f8f8f8;padding:20px 24px;text-align:center;color:#888;font-size:13px;border-top:1px solid #e0e0e0;">
        <p style="margin:0;">Florida Coastal Prep LLC &middot; <a href="https://coachprincetonbasketball.com" style="color:#888;">coachprincetonbasketball.com</a></p>
      </div>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Coach Princeton Basketball <orders@coachprincetonbasketball.com>',
      to: [customerEmail],
      subject: `Your ${productInfo.name} – Download Links Inside`,
      html
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Resend error:', errText);
  }
}
