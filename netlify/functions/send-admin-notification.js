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
    const { name, email, phone, handicap, teamCaptain, timestamp } = JSON.parse(event.body);
    
    // Get environment variables
    const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
    const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    
    if (!MAILCHIMP_API_KEY || !MAILCHIMP_AUDIENCE_ID || !ADMIN_EMAIL) {
      throw new Error('Mailchimp configuration missing');
    }

    // Extract datacenter from API key (us20, us21, etc.)
    const datacenter = MAILCHIMP_API_KEY.split('-')[1];
    
    // Add/update admin with request details as merge fields
    await addOrUpdateMember(
      ADMIN_EMAIL, 
      'Admin', 
      '', 
      MAILCHIMP_API_KEY, 
      MAILCHIMP_AUDIENCE_ID, 
      datacenter, 
      ['admin-notification'], 
      {
        'RNAME': name || '',
        'REMAIL': email || '',
        'RPHONE': phone || '',
        'RHANDICAP': handicap || 'Not provided',
        'RCAPTAIN': teamCaptain ? 'Yes' : 'No',
        'RTIME': new Date(timestamp).toLocaleString() || new Date().toLocaleString()
      }
    );
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Admin notification triggered successfully'
      })
    };

  } catch (error) {
    console.error('Error sending admin notification:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        error: 'Failed to send admin notification',
        details: error.message 
      })
    };
  }
};

function addOrUpdateMember(email, name, phone = '', apiKey, audienceId, datacenter, tags = [], mergeFields = {}) {
  return new Promise((resolve, reject) => {
    const emailHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
    
    const memberData = {
      email_address: email,
      status: 'subscribed',
      merge_fields: {
        FNAME: name.split(' ')[0] || name,
        LNAME: name.split(' ').slice(1).join(' ') || '',
        PHONE: phone,
        ...mergeFields
      },
      tags: tags
    };

    const postData = JSON.stringify(memberData);
    
    const options = {
      hostname: `${datacenter}.api.mailchimp.com`,
      port: 443,
      path: `/3.0/lists/${audienceId}/members/${emailHash}`,
      method: 'PUT', // PUT will create or update
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
        try {
          const response = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`Mailchimp API error: ${response.detail || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${data}`));
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