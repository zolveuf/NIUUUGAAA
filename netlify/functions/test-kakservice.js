console.log('test-kakservice function loaded');

exports.handler = async (event, context) => {
  console.log('=== TEST KAKSERVICE FUNCTION CALLED ===');
  console.log('Method:', event.httpMethod);
  console.log('Body:', event.body);
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify({ 
      success: true,
      message: 'Test function works!',
      timestamp: new Date().toISOString()
    })
  };
};
