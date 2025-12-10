const axios = require('axios')
const { phoneEnteredEventData, abandonCartEventData, abandonCartWithoutAddressEventData } = require('../data/dataTypes.js')

const WEBHOOK_URL = 'http://localhost:8080/webhook/store1'

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

    console.log('🧪 Testing all 4 scenarios for duplicate prevention:\n')

    // Scenario 1: PR -> AC (Phone Received first, then Abandon Cart)
    console.log('\n🟢 SCENARIO 1: Phone Received -> Abandon Cart (Update message)')
    const cart1 = { ...phoneEnteredEventData, cart_id: 'test_cart_scenario_9' }
    const cart1AC = { ...abandonCartEventData, cart_id: 'test_cart_scenario_9' }
    await testWebhook('Scenario 1 - Phone Received', cart1)
    await new Promise(resolve => setTimeout(resolve, 30_000))
    await testWebhook('Scenario 1 - Abandon Cart (Should UPDATE)', cart1AC)
    await new Promise(resolve => setTimeout(resolve, 30_000))

    // Scenario 2: AC only (Abandon Cart first and only)
    console.log('\n🟢 SCENARIO 2: Abandon Cart Only (New message)')
    const cart2 = { ...abandonCartEventData, cart_id: 'test_cart_scenario_10' }
    await testWebhook('Scenario 2 - Abandon Cart Only', cart2)
    await new Promise(resolve => setTimeout(resolve, 30_000))

    // Scenario 3: PR only (Phone Received first and only)
    console.log('\n🟢 SCENARIO 3: Phone Received Only (New message)')
    const cart3 = { ...phoneEnteredEventData, cart_id: 'test_cart_scenario_11' }
    await testWebhook('Scenario 3 - Phone Received Only', cart3)
    await new Promise(resolve => setTimeout(resolve, 30_000))

    // Scenario 4: AC -> PR (Abandon Cart first, then Phone Received - should NOT send/update)
    console.log('\n🟢 SCENARIO 4: Abandon Cart -> Phone Received (No action)')
    const cart4 = { ...abandonCartEventData, cart_id: 'test_cart_scenario_12' }
    const cart4PR = { ...phoneEnteredEventData, cart_id: 'test_cart_scenario_12' }
    await testWebhook('Scenario 4 - Abandon Cart', cart4)
    await new Promise(resolve => setTimeout(resolve, 30_000))
    await testWebhook('Scenario 4 - Phone Received (Should IGNORE)', cart4PR)

    console.log('\n' + '='.repeat(60))
    console.log('✨ All tests completed!')
    console.log('='.repeat(60))
    console.log('\n📊 Summary:')
    console.log('- Scenario 1: Should send 1 message, then UPDATE it')
    console.log('- Scenario 2: Should send 1 NEW message')
    console.log('- Scenario 3: Should send 1 NEW message')
    console.log('- Scenario 4: Should send 1 message, then IGNORE second event')
    console.log('='.repeat(60))
}

runTests()
