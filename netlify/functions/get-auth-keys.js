exports.handler = async () => ({
    statusCode: 200,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
        clientKey: process.env.AUTHNET_CLIENT_KEY,
        apiLoginId: process.env.AUTHNET_API_LOGIN_ID
    })
});
