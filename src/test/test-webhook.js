const axios = require('axios')
const { type1, type2, type3 } = require('../data/dataTypes.js')

const WEBHOOK_URL = 'http://localhost:8080/webhook'

async function testWebhook(type, data) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing ${type}...`)
    console.log('='.repeat(60))

    try {
        const response = await axios.post(WEBHOOK_URL, data, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        console.log(`✅ ${type} - Status: ${response.status}`)
        console.log('Response:', JSON.stringify(response.data, null, 2))
    } catch (error) {
        console.error(`❌ ${type} - Error:`, error.message)
        if (error.response) {
            console.error('Response data:', error.response.data)
        }
    }
}

async function runTests() {
    console.log('🚀 Starting webhook tests...\n')
    console.log('Make sure the server is running on http://localhost:8080\n')

    // Wait a bit between requests
    await testWebhook('Type 1 (Full Order with Shipping)', type1)
    await new Promise(resolve => setTimeout(resolve, 2000))

    await testWebhook('Type 2 (Multiple Items)', type2)
    await new Promise(resolve => setTimeout(resolve, 2000))

    await testWebhook('Type 3 (Minimal Cart)', type3)

    console.log('\n' + '='.repeat(60))
    console.log('✨ All tests completed!')
    console.log('='.repeat(60))
}

runTests()
