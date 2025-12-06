/**
 * this event is fired when user enters phone number in checkout page
 */
export const phoneEnteredEventData = {
    cart_id: '693298dff686895a3e33f582',
    latest_stage: 'PHONE_RECEIVED',
    currency: 'INR',
    item_count: 1,
    source_name: 'fastrr',
    total_price: 3299,
    phone_number: '9151521879',
    phone_verified: false,
    shipping_price: 0,
    total_discount: 0,
    tax: 0,
    cart_attributes: {
        shopifyCartToken: 'hWN61dxW0mJw96GlDi3NyVBh?key=3ada625cda04e788a7892d97572fb0ec',
        landing_page_url: 'https://www.hestern.in/?_ab=0&_fd=0&_sc=1',
        ipv4_address: '110.226.218.6',
    },
}

/**
 * this event is fired when user abandons the cart
 */
export const abandonCartEventData = {
    rtoPredict: 'low',
    cart_id: '6932795d75348b363d836d1c',
    cart_token: 'hWN61dxW0mJw96GlDi3NyVBh?key=3ada625cda04e788a7892d97572fb0ec',
    latest_stage: 'ORDER_SCREEN',
    updated_at: '2025-12-05T11:49:09.255',
    email: '',
    img_url: 'https://cdn.shopify.com/s/files/1/0658/4218/4354/files/36_653aa516-2831-4342-909a-6f19273a46aa.webp?v=1763406839',
    items: [
        {
            name: 'Urban Voyager Leather Belt Bag - Red Colour',
            price: 3299,
            title: 'Urban Voyager Leather Belt Bag - Red Colour',
            quantity: 1,
            product_id: 8615698399394,
            custom_attributes: {
                contentId: '8615698399394',
            },
            variant_id: 45854648631458,
            img_url: 'https://cdn.shopify.com/s/files/1/0658/4218/4354/files/36_653aa516-2831-4342-909a-6f19273a46aa.webp?v=1763406839',
        },
    ],
    currency: 'INR',
    sku_list: [null],
    last_name: 'Singh',
    first_name: 'Aman',
    item_count: 1,
    source_name: 'fastrr',
    total_price: 3199,
    checkout_url: 'https://hestern.in/?cart-resume-id=6932795d75348b363d836d1c&type=report',
    phone_number: '9151521879',
    discount_codes: ['PrepaidDiscount'],
    item_name_list: ['Urban Voyager Leather Belt Bag - Red Colour'],
    payment_status: 'Pending',
    shipping_price: 0,
    total_discount: 100,
    tax: 0,
    billing_address: {
        zip: '226022',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        name: 'Aman Singh',
        phone: '9151521879',
        country: 'India',
        address1: 'H. No. 529 D/1/1443 80 Near SR Memorial Inter College, Adil Nagar,',
        last_name: 'Singh',
        first_name: 'Aman',
        country_code: 'IN',
    },
    item_price_list: ['3299.0'],
    item_title_list: ['Urban Voyager Leather Belt Bag - Red Colour'],
    product_id_list: ['8615698399394'],
    variant_id_list: ['45854648631458'],
    shipping_address: {
        zip: '226022',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        name: 'Aman Singh',
        phone: '9151521879',
        country: 'India',
        address1: 'H. No. 529 D/1/1443 80 Near SR Memorial Inter College, Adil Nagar,',
        last_name: 'Singh',
        first_name: 'Aman',
        country_code: 'IN',
    },
    custom_attributes: {
        shopifyCartToken: 'hWN61dxW0mJw96GlDi3NyVBh?key=3ada625cda04e788a7892d97572fb0ec',
        landing_page_url: 'https://www.hestern.in/?_ab=0&_fd=0&_sc=1',
        ipv4_address: '110.226.218.6',
    },
}

/**
 * same event as abandon cart but without address info
 */
export const abandonCartWithoutAddressEventData = {
    cart_id: '6932967c75348b363d83cf13',
    cart_token: 'hWN62X6Q9PzQh0VUptGClri0?key=3f8cbf0b18407fb63f1c913bca263b00',
    latest_stage: 'PHONE_RECEIVED',
    updated_at: '2025-12-05T13:53:24.968',
    img_url: 'https://cdn.shopify.com/s/files/1/0658/4218/4354/files/24_d15e4af0-8008-48bf-8b89-4104cf8eecea.webp?v=1763704786',
    items: [
        {
            name: 'AmberStride Leather Sling Bag - Black Colour',
            price: 2999,
            title: 'AmberStride Leather Sling Bag - Black Colour',
            quantity: 1,
            product_id: 8659489030306,
            custom_attributes: {
                contentId: '8659489030306',
            },
            variant_id: 45852798451874,
            img_url: 'https://cdn.shopify.com/s/files/1/0658/4218/4354/files/24_d15e4af0-8008-48bf-8b89-4104cf8eecea.webp?v=1763704786',
        },
        {
            sku: '',
            name: 'Alpine Vintage Leather Laptop Backpack - Maroon Colour',
            price: 7799,
            title: 'Alpine Vintage Leather Laptop Backpack - Maroon Colour',
            quantity: 1,
            product_id: 8612910825634,
            custom_attributes: {
                contentId: '8612910825634',
            },
            variant_id: 45327319007394,
            img_url: 'https://cdn.shopify.com/s/files/1/0658/4218/4354/files/01_53cd8adf-6d6d-4c80-8ae1-7a12ea7c9776.webp?v=1763475267',
        },
    ],
    currency: 'INR',
    sku_list: [null, ''],
    item_count: 2,
    source_name: 'fastrr',
    total_price: 10798,
    checkout_url: 'https://hestern.in/?cart-resume-id=6932967c75348b363d83cf13&type=report',
    phone_number: '9151521879',
    discount_codes: ['null'],
    item_name_list: ['AmberStride Leather Sling Bag - Black Colour', 'Alpine Vintage Leather Laptop Backpack - Maroon Colour'],
    shipping_price: 0,
    total_discount: 0,
    tax: 0,
    item_price_list: ['2999.0', '7799.0'],
    item_title_list: ['AmberStride Leather Sling Bag - Black Colour', 'Alpine Vintage Leather Laptop Backpack - Maroon Colour'],
    product_id_list: ['8659489030306', '8612910825634'],
    variant_id_list: ['45852798451874', '45327319007394'],
    custom_attributes: {
        shopifyCartToken: 'hWN62X6Q9PzQh0VUptGClri0?key=3f8cbf0b18407fb63f1c913bca263b00',
        landing_page_url: 'https://www.hestern.in/',
        ipv4_address: '110.226.218.6',
    },
}

/**
 * event phone recieved (PR)
 * event abandon cart (AC)
 * 1. PR -> AC
 * 2. AC
 * 3. PR
 * 4. AC -> PR
 */
