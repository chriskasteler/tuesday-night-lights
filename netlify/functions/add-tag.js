const https = require('https');
const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, tag } = JSON.parse(event.body);
    
    // Get environment variables
    const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
    const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
    
    if (!MAILCHIMP_API_KEY || !MAILCHIMP_AUDIENCE_ID) {
      throw new Error('Mailchimp configuration missing');
    }

    // Extract datacenter from API key (us20, us21, etc.)
    const datacenter = MAILCHIMP_API_KEY.split('-')[1];
    
    // Add tag to user
    await addTagToMember(email, tag, MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID, datacenter);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        success: true, 
        message: `Tag '${tag}' added to ${email} successfully`
      })
    };

  } catch (error) {
    console.error('Error adding tag:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        error: 'Failed to add tag',
        details: error.message 
      })
    };
  }
};

function addTagToMember(email, tag, apiKey, audienceId, datacenter) {
  return new Promise((resolve, reject) => {
    const emailHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
    
    const tagData = {
      tags: [{ name: tag, status: 'active' }]
    };

    const postData = JSON.stringify(tagData);
    
    const options = {
      hostname: `${datacenter}.api.mailchimp.com`,
      port: 443,
      path: `/3.0/lists/${audienceId}/members/${emailHash}/tags`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          try {
            const response = JSON.parse(data);
            reject(new Error(`Mailchimp API error: ${response.detail || data}`));
          } catch (error) {
            reject(new Error(`Failed to parse error response: ${data}`));
          }
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
} 