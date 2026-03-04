# Sello API v5 Reference

Source: https://docs.sello.io

[NAV](#)

              [php](#)
              [shell](#)






          - Introduction

          - Authentication

          - Localization

          - Best Practices


                    Rate limits



          - Account


                    Get account information

                  - Stats: Summary

                  - Stats: Daily turnover

                  - Stats: Monthly turnover

                  - Stats: Stockworth

                  - Stats: Status

                  - Stats: Topsellers



          - Auctions


                    Adding products to the outbox

                  - Listing items in the outbox

                  - Publish the outbox

                  - Delete an outbox item



          - Categories


                    Get Sello categories

                  - Getting subcategories for an integration

                  - Getting a single category for an integration

                  - Getting a single Sello category information



          - Import


                    Products: Fyndiq

                  - Products: Woocommerce

                  - Products: Xlsx

                  - Products: CSV



          - Integrations


                    Getting all integrations

                  - Getting a single integration



          - Market


                    Get your eBay Warehouses

                  - Create an eBay Warehouse

                  - Get your eBay Policies

                  - Create an eBay Policy



          - Messages


                    Getting number of unread messages

                  - Getting messages

                  - Set messages as read

                  - Delete messages



          - Orders


                    Getting orders

                  - Add an order

                  - Copy an order

                  - Merge orders

                  - Change an order

                  - Change multiple orders

                  - Getting delivery notes

                  - Getting delivery notes by market order number

                  - Getting order rows

                  - Add an order row

                  - Change an order row

                  - Create/update order row return

                  - Delete an order row

                  - Separate an order row

                  - Get order deliveries

                  - Add order delivery

                  - Remove an order delivery

                  - Get order history

                  - Make receipts

                  - Make Trading documents



          - Products


                    Getting products

                  - Add a product

                  - Copy a product

                  - Change a product

                  - Delete a product

                  - Add images

                  - Delete an image

                  - Change cover image

                  - Bulk-editing products

                  - Get product history

                  - Get available product properties

                  - Get required and recommended properties for a certain category

                  - Create stock value document



          - Product map API


                    Submit product data



          - Purchase orders


                    Getting purchase orders

                  - Add a purchase order

                  - Copy a purchase order

                  - Change a purchase order

                  - Delete a purchase order

                  - Getting purchase order rows

                  - Add an order row

                  - Change purchase order rows

                  - Delete a purchase order row

                  - Getting purchase order Excel file



          - Settings


                    Getting settings

                  - Update settings



          - Shipping


                    Get Unifaun settings

                  - Update Unifaun settings

                  - Get all Unifaun transporters

                  - Get a specific Unifaun transporter

                  - Update a Unifaun transporter

                  - Get services for a Unifaun transporter

                  - Sending orders to Unifaun (make shipping labels)

                  - Getting history

                  - Sending orders to Pacsoft (make shipping labels)

                  - Sending orders to Multishipping (make shipping labels)



          - Status


                    Get all status

                  - Get a single status

                  - Add a status

                  - Change a status

                  - Remove a status



          - Suppliers


                    Getting suppliers

                  - Add a supplier

                  - Delete a supplier

                  - Change a supplier



          - Tax


                    Get all tax classes

                  - Get a single tax class

                  - Add a tax class

                  - Change a tax class

                  - Remove a tax class



          - Webhooks


                    Configuring webhooks

                  - Securing webhooks

                  - Supported events

                  - Event data

                  - Get all webhooks

                  - Add a webhook

                  - Change webhooks

                  - Remove a webhook





            - Documentation Powered by Slate








# Introduction

Welcome to the Sello API v5! You can use our API to access Sello API endpoints, which can get and change information on orders, products and settings.

We have code samples in Shell/curl, and PHP. You can view code examples in the dark area to the right, and you can switch the programming language of the examples with the tabs in the top right.

# Authentication

To authorize, use this code:

```

```

# With shell, you can just pass the correct header with each request

curl "api_endpoint_here"
-H "Authorization: meowmeowmeow"

```

Make sure to replace `meowmeowmeow` with your API key.

Sello uses API keys to allow access to the API. You can register a new API key in your account settings.

Sello expects for the API key to be included in all API requests to the server in a header that looks like the following:

`Authorization: meowmeowmeow`

You must replace `meowmeowmeow` with your personal API key.

# Localization

Most resouces are able to return localized content (error messages, data etc). To specify your preferred language, use `Accept-Language` header. If your language is unsupported, English will be used.

```

```
curl "api_endpoint_here"
  -H "Authorization: meowmeowmeow" -H "Accept-Language: en"
```

# Best Practices

You are highly encouraged to build your system asynchronous, meaning every request that doesn't require an immediate response should be internally enqueued and processed in order.

## Rate limits

The API is by default limited to 30 calls per minute. You may request an increase at support@sello.io. In every request you'll recieve three headers containing information about your rate limit:

- `X-RateLimit-Limit`: What your rate limit is (30 by default)

- `X-RateLimit-Reset`: When the current limit expires - meaning when you will get re-filled with requests

- `X-RateLimit-Remaining`: How many requests you can still do until being throttled

# Account

## Get account information

```

```

curl "https://api.sello.io/v5/account" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"is_agent": "1",
"currency": "SEK",
"zip": "10202",
"average_sales": "13512",
"setup_completed": "1",
"email": "support@sello.io",
"country": "SE",
"beta": "0",
"city": "Stockholm",
"invoices": {
"overdue": [],
"unpaid": [
"Kf7gWr6"
]
},
"referrer": "0",
"company": "Chrille AB",
"notes": "",
"id": "8346",
"phone": "07012345667",
"vat_number": "556688-8880",
"flags": "H",
"created_at": "2009-02-12 14:05:04",
"invoice_email": "invoices@sello.io",
"industry_id": null,
"address": "King Street 8",
"paid_to": "2020-12-12",
"type": "commission"
}

```

This endpoint will retrieve information about the callee's account.

### HTTP Request

`GET https://api.sello.io/v5/account`

## Stats: Summary

Stats is updated nightly and returned in currency according to your settings.

```

```
curl "https://api.sello.io/v5/account/stats" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
{
  "purchasecost": {
    "previous": 770543,
    "current": 635759
  },
  "numorders": {
    "previous": 5460,
    "current": 4662
  },
  "ordervalue": {
    "previous": 367.27,
    "current": 359.02
  },
  "turnover": {
    "previous": 1568013.27,
    "current": 1248030.49
  }
}
```

Will return a breif summary of important stats the current 30 days and a comparison value for the previous 30 days.

| Field | Description |
| purchasecost | The total purchase cost (product purchase cost &times; amount sold) |
| numorders | Total amount of orders |
| ordervalue | Average order total |
| turnover | Total sales |

### HTTP Request

`GET https://api.sello.io/v5/account/stats`

## Stats: Daily turnover

```

```

curl "https://api.sello.io/v5/account/stats/turnover/daily" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

[
{
"0": 4238.07,
"10108": 2467,
"13159": 39373.99,
"14333": 10524.2,
"14803": 4833,
"date": "2017-02-27"
},
{
"0": 7518.27,
"10108": 2465,
"13159": 30993.48,
"14333": 7488.4,
"14803": 3948,
"35043": 223,
"date": "2017-02-28"
},
{
"0": 5567.85,
"10108": 1905,
"13159": 29419.64,
"14333": 7510.7,
"14803": 4580,
"35043": 507,
"date": "2017-03-01"
},
{
"0": 4780.34,
"10108": 2208,
"13159": 23110.73,
"14333": 4502.4,
"14803": 7962,
"32778": 944,
"35043": 355,
"date": "2017-03-02"
}
]

```

Daily turnover the past 30 days, per integration. The key of the object is integration id, the value is the turnover. Integration 0 means "custom" order that has been made outside a marketplace.

### HTTP Request

`GET https://api.sello.io/v5/account/stats/turnover/daily`

## Stats: Monthly turnover

```

```
curl "https://api.sello.io/v5/account/stats/turnover/monthly" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
[
  {
    "10108": 4768.8,
    "13159": 34029.35,
    "14333": 9233.8,
    "14803": 35292,
    "date": "2016-03"
  },
  {
    "0": 13395.17,
    "10108": 30119.2,
    "13159": 482521.60,
    "14333": 96822.72,
    "14803": 278363.2,
    "32778": 4935.04,
    "date": "2016-04"
  },
  {
    "0": 15687.6,
    "10108": 45848,
    "13159": 391407.64,
    "14333": 143643.2,
    "14803": 286581.03,
    "32778": 7823,
    "date": "2016-05"
  }
]
```

Monthly turnover the past year, per integration. The key of the object is integration id, the value is the turnover. Integration 0 means "custom" order that has been made outside a marketplace.

### HTTP Request

`GET https://api.sello.io/v5/account/stats/turnover/monthly`

## Stats: Stockworth

```

```

curl "https://api.sello.io/v5/account/stats/stockworth" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

[
{
"date": "2017-03-27",
"worth": 1994793
},
{
"date": "2017-03-28",
"worth": 2004693
},
{
"date": "2017-03-29",
"worth": 1992246
}
]

```

The worth of your inventory per day.

### HTTP Request

`GET https://api.sello.io/v5/account/stats/stockworth`

## Stats: Status

```

```
curl "https://api.sello.io/v5/account/stats/status" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
[
  {
    "status_id": "2586859",
    "num": 8
  },
  {
    "status_id": "2612307",
    "num": 115
  },
  {
    "status_id": "2622237",
    "num": 2
  },
  {
    "status_id": "2625725",
    "num": 8
  },
  {
    "status_id": "2628202",
    "num": 2
  }
]
```

Number of active orders per status

### HTTP Request

`GET https://api.sello.io/v5/account/stats/status`

## Stats: Topsellers

```

```

curl "https://api.sello.io/v5/account/stats/topsellers" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

[
{
"image_url_small": "http://stat.sello.nu/item/98/6dd.jpg",
"product_id": "422443",
"product_name": "David Beckham Intimately For Him Edt 75ml",
"num_sold": "116"
},
{
"image_url_small": "http://stat.sello.nu/item/984ui4kj.jpg",
"product_id": "424556",
"product_name": "David Beckham Homme Edt 75ml",
"num_sold": "42"
},
{
"image_url_small": "https://images.sello.io/product/b57/c12b50b574ecf3c6c659de59.jpg",
"product_id": "65322",
"product_name": "Burberry Brit Rhythm Men Edt 50ml",
"num_sold": "34"
},
{
"image_url_small": "https://images.sello.io/product/80e/e3c4cc80ee4251d451e749d3fde.jpg",
"product_id": "5555444",
"product_name": "Elizabeth Arden Mediterranean Edp 100ml",
"num_sold": "34"
},
{
"image_url_small": "http://stat.sello.nu/item/98/609.jpg",
"product_id": "34555",
"product_name": "David Beckham The Essence Edt 75ml",
"num_sold": "23"
}
]

```

Your 5 top most sold products the past month.

### HTTP Request

`GET https://api.sello.io/v5/account/stats/topsellers`

# Auctions

To create autions or fixed price-items on for example Tradera and eBay, you first add your products to the outbox. Once in the outbox, you can specify publishing times, prices etc. To publish the auctions, you publish the outbox.

## Adding products to the outbox

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"productIds":[123, 456]}' https://api.sello.io/v5/outbox/{integrationId}
```

The above command will respond with status `201` and return the id's of the outbox items:

```
{
  "ids": [14475806, 14475807]
}
```

Add products to the outbox of a specified integration.

### HTTP Request

`POST https://api.sello.io/v5/outbox/{integrationId}`

## Listing items in the outbox

```

```

curl -H "Authorization: meowmeowmeow" https://api.sello.io/v5/outbox/{integrationId}

```

The above command will respond with status `200` and an array of outbox items:

```

[
{
"buynow_price": 13,
"duration": 30,
"id": 1799011,
"options": [],
"product": {
"category": "Photo, Cameras & Optics > Analog Cameras > Camcorders",
"id": 43609235,
"image": "https://images.sello.io/products/d5b2b58f01dd4dd82c63b95fd222dfb5.jpg",
"name": "My product name"
},
"reservation_price": 12,
"scheduled_time": "2020-05-26T11:40:42.280Z",
"start_price": 1,
"type": "buynow"
}
]

```

Show items in the outbox.

### HTTP Request

`GET https://api.sello.io/v5/outbox/{integrationId}`

## Publish the outbox

```

Analog Cameras > Camcorders","id":43609235,"image":"https://images.sello.io/products/d5b2b58f01dd4dd82c63b95fd222dfb5.jpg","name":"test product"},"reservation_price":12,"scheduled_time":"2020-05-26T11:40:42.280Z","start_price":1,"type":"buynow"}]');
curl_setopt($handle, CURLOPT_HTTPHEADER, [
'Accept: application/json',
'Content-Type: application/json',
'Authorization: meowmeowmeow'
]);

$response = curl_exec($handle);
$code = curl_getinfo($handle, CURLINFO_HTTP_CODE);

echo "Code: $code, response: $response";

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '[{"buynow_price":13,"duration":30,"id":1799011,"options":[],"product":{"category":"Photo, Cameras & Optics > Analog Cameras > Camcorders","id":43609235,"image":"https://images.sello.io/products/d5b2b58f01dd4dd82c63b95fd222dfb5.jpg","name":"test product"},"reservation_price":12,"scheduled_time":"2020-05-26T11:40:42.280Z","start_price":1,"type":"buynow"}]' https://api.sello.io/v5/outbox/{integrationId}/publish

```

The above command will respond with status `201` on success.

```

{ "message": "Items have been added to queue" }

```

Publish the supplied items. The items should have the same format as when you GET outbox.

### HTTP Request

`POST https://api.sello.io/v5/outbox/{integrationId}/publish`

## Delete an outbox item

```

```
curl -H "Authorization: meowmeowmeow" -X DELETE https://api.sello.io/v5/outbox/{integrationId}/item/{id}
```

The above command will respond with status `200` if successful

This endpoint will remove an item from the outbox.

### HTTP Request

`DELETE https://api.sello.io/v5/outbox/{integrationId}/item/{id}`

# Categories

## Get Sello categories

```

```

curl "https://api.sello.io/v5/categories/{parent}" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

[
{
"id": "340208",
"parent": "161201",
"map": {
"1": {
"id": "340208",
"name": "Dam",
"crumb": "Accessoarer > Solglasögon > Dam"
},
"6": {
"id": "6313",
"name": "Dam",
"crumb": "Mode > Accessoarer > Solglasögon & Glasögon > Solglasögon > Dam"
}
},
"path": [
"1612",
"161201",
"340208"
],
"name": "Dam",
"crumb": "Accessoarer > Solglasögon > Dam"
},
...
]

```

Sello categories are our own internal categories, these categories are mapped against marketplace and webshop categories. The advantage is that you only need to choose one category, and then mapping take care of the rest. Mappings are constantly learned/updated.

### HTTP Request

`GET https://api.sello.io/v5/categories/{parent}`

### Data

| Parameter | Description |
| parent | Parent category id to fetch subcategories from. Use 0 to fetch root categories |

### Localization

Use `Accept-Language` header to specify your preferred language. Currently supported languages are: en, sv, no, da, fi, de

## Getting subcategories for an integration

```

```
curl "https://api.sello.io/v5/categories/{integration}/{parent}" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
[
  {
    "id": "10",
    "name": "Vehicles, Boats & Parts",
    "crumb": "Vehicles, Boats & Parts",
    "parent_id": "0",
    "path": [
      "0",
      "10"
    ]
  },
  {
    "id": "11",
    "name": "Books & Magazines",
    "crumb": "Books & Magazines",
    "parent_id": "0",
    "path": [
      "0",
      "11"
    ]
  },
  {
    "id": "12",
    "name": "Computers & Accessories",
    "crumb": "Computers & Accessories",
    "parent_id": "0",
    "path": [
      "0",
      "12"
    ]
  }
]
```

This endpoint will retrieve all subcategories for an integration and the parent id you specify.

### HTTP Request

`GET https://api.sello.io/v5/categories/{integration}/{parent}`

### Data

| Parameter | Description |
| integration | The integration id you want to fetch categories from |
| parent | Parent category id to fetch subcategories from. Use 0 to fetch root categories |

### Localization

Use `Accept-Language` header to specify your preferred language. Currently supported languages are: en, sv, no, da, fi, de

## Getting a single category for an integration

```

```

curl "https://api.sello.io/v5/categories/{integration}/{id}/info" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"id": "10",
"name": "Vehicles, Boats & Parts",
"crumb": "Vehicles, Boats & Parts",
"parent_id": "0",
"path": [
"0",
"10"
]
}

```

This endpoint will retrieve a single category an integration.

### HTTP Request

`GET https://api.sello.io/v5/categories/{integration}/{id}/info`

### Data

| Parameter | Description |
| integration | The integration id you want to fetch categories from |
| id | Category id to fetch information about. |

### Localization

Use `Accept-Language` header to specify your preferred language. Currently supported languages are: en, sv, no, da, fi, de

## Getting a single Sello category information

```

```
curl "https://api.sello.io/v5/categories/{id}/info" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
{
  "id": "340210",
  "parent": "161201",
  "map": {
    "1": {
      "id": "340210",
      "name": "Unisex",
      "crumb": "Accessoarer > Solglasögon > Unisex"
    },
    "6": {
      "id": "512",
      "name": "Solglasögon",
      "crumb": "Mode > Accessoarer > Solglasögon & Glasögon > Solglasögon"
    },
    "10": {
      "id": "225",
      "name": "Sunglasses",
      "crumb": "ClothingAccessories > GlassesAndShades > Sunglasses"
    },
    "13": {
      "id": "5332207031",
      "name": "Unisex",
      "crumb": "Baby Products > Baby Clothing > Unisex"
    }
  },
  "path": [
    "1612",
    "161201",
    "340210"
  ],
  "name": "Unisex",
  "crumb": "Accessoarer > Solglasögon > Unisex"
}
```

This endpoint will retrieve a single Sello category.

### HTTP Request

`GET https://api.sello.io/v5/categories/{integration}/{id}/info`

### Data

| Parameter | Description |
| integration | The integration id you want to fetch categories from |
| id | Category id to fetch information about. |

### Localization

Use `Accept-Language` header to specify your preferred language. Currently supported languages are: en, sv, no, da, fi, de

# Import

Sello support multiple ways of importing products and orders to the platform. See respective section:

## Products: Fyndiq

```

```

curl -H "Authorization: meowmeowmeow" -X POST https://api.sello.io/v5/import/products/fyndiq/{integration}

```

The above command will respond with status `202` to inform that the import has been triggered. The import will be processed in the background.

### HTTP Request

`POST https://api.sello.io/v5/import/products/fyndiq/{integration}`

Replace `integration` with the integration id you wish to import from.

## Products: Woocommerce

```

```
curl -H "Authorization: meowmeowmeow" -X POST https://api.sello.io/v5/import/products/woocommerce/{integration}
```

The above command will respond with status `202` to inform that the import has been triggered. The import will be processed in the background.

### HTTP Request

`POST https://api.sello.io/v5/import/products/woocommerce/{integration}`

Replace `integration` with the integration id you wish to import from.

## Products: Xlsx

### Importing a file

```
post(
    'https://api.sello.io/v5/import/products/csv',
    [
        'headers' => [
            'Authorization' => 'meowmeowmeow'
        ]
        'multipart' => [
            [
                'name' => 'file',
                'contents' => fopen('/path/to/file.xlsx', 'r')
            ],
            [
                'name' => 'payload',
                'contents' => json_encode(
                    [
                        'mode' => 'create',
                        'integrations' => [
                            'tradera' => 4,
                            'fyndiq' => 19
                        ]
                    ]
                )
            ]
        ]
    ]
);

$body = $response->getBody();
$code = $response->getStatusCode();

echo "Code: $code, response: $response";
```

```
curl -H "Authorization: meowmeowmeow" -X POST -F "file=@/path/to/file.xlsx" -d "payload={'mode':'create', 'integrations': {'tradera': 4, 'fyndiq': 19}}" https://api.sello.io/v5/import/products/xlsx
```

The above command will respond with status `201` and how many rows in the xlsx file were processed.

### HTTP Request

`POST https://api.sello.io/v5/import/products/xlsx`

Upload the xlsx file called `file` and send json payload as `payload` start either an import or an update of products depending on `mode`.

| Parameter | Required? | Description |
| file | yes | The xlsx file upload (see example) |
| payload | yes | JSON object with attributes: `mode` either `create` or `update`. `integrations` should be an object with market name to integration id, like `{"tradera":4}` |

## Products: CSV

### Creating an import session

```
post(
    'https://api.sello.io/v5/import/products/csv',
    [
        'headers' => [
            'Authorization' => 'meowmeowmeow'
        ]
        'multipart' => [
            [
                'name' => 'file',
                'contents' => fopen('/path/to/file.csv', 'r')
            ]
        ]
    ]
);

$body = $response->getBody();
$code = $response->getStatusCode();

echo "Code: $code, response: $response";
```

```
curl -H "Authorization: meowmeowmeow" -X POST -F "file=@/path/to/file.csv"  https://api.sello.io/v5/import/products/csv
```

The above command will respond with status `201` and data about the processed file. To start the import, you need to `POST` to start (see below).

### HTTP Request

`POST https://api.sello.io/v5/import/products/csv`

Upload the csv file called `file`. This will generate a import session and return the first 5 lines of parsed data in your csv file. Use this data to map the fields and issue `POST` to `start` (see below).

### Starting an import session

```
post(
    'https://api.sello.io/v5/import/products/csv/123456/start',
    [
        'body' => json_encode([
            'mode' => 'create',
            'map' => [] // The field mapping
        ])
    ]
);

$body = $response->getBody();
$code = $response->getStatusCode();

echo "Code: $code, response: $response";
```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"mode":"create", "map":[]' https://api.sello.io/v5/import/products/csv/123456/start
```

The above command will respond with status `202` to indicate that the file has been put in queue for processing with your supplied mapping.

### HTTP Request

`POST https://api.sello.io/v5/import/products/csv/{session}/start`

### Data

| Parameter | Required? | Description |
| map | yes | Column mapping |
| mode | yes | `create` if the import should create new products, `update` if products should be updated |

# Integrations

An integration is the term for a connection between Sello and a service. These integrations generally contains API credentials and integration-specific settings.

## Getting all integrations

```

```

curl "https://api.sello.io/v5/integrations" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

[
{
"id": 4,
"user_id": 8346,
"market_id": 1,
"market_user_id": "123",
"market_token": "abc-my-secret-token",
"extra": "1",
"endpoint": "",
"display_name": "Tradera",
"created_at": "2014-10-01T13:08:09.000Z",
"last_order_check": "2017-10-25T08:40:15.000Z",
"expires_at": "2016-02-29T11:44:21.000Z",
"status_id_paid": null,
"status_id_unpaid": null,
"status": "active",
"status_updated": "2014-11-20T13:04:30.000Z",
"sandbox": 0,
"version": null,
"type": "marketplace",
"initials": "TRAD",
"parent_id": 0
}
]

```

This endpoint will retrieve all integrations on an account.

### HTTP Request

`GET https://api.sello.io/v5/integrations`

## Getting a single integration

To fetch a specific integration, use this endpoint:

`GET https://api.sello.io/v5/integrations/{id}`

```

```
curl -H "Authorization: meowmeowmeow" https://api.sello.io/v5/integrations/4
```

The above command will respond with status `200` and return the integration:

```
{
    "id": 4,
    "user_id": 8346,
    "market_id": 1,
    "market_user_id": "123",
    "market_token": "abc-my-secret-token",
    "extra": "1",
    "endpoint": "",
    "display_name": "Tradera",
    "created_at": "2014-10-01T13:08:09.000Z",
    "last_order_check": "2017-10-25T08:40:15.000Z",
    "expires_at": "2016-02-29T11:44:21.000Z",
    "status_id_paid": null,
    "status_id_unpaid": null,
    "status": "active",
    "status_updated": "2014-11-20T13:04:30.000Z",
    "sandbox": 0,
    "version": null,
    "type": "marketplace",
    "initials": "TRAD",
    "parent_id": 0
}
```

This endpoint will retrieve an integration.

### HTTP Request

`GET https://api.sello.io/v5/integrations/{id}`

# Market

## Get your eBay Warehouses

```

```

curl "https://api.sello.io/v5/market/ebay/{integration}/warehouses" -H "Authorization: meowmeowmeow"

```

The above command returns an array of warehouses like this:

```

[
{
"id": "default",
"name": "Warehouse-1",
"description": "Items ship from here.",
"address": "2055 Hamilton Ave",
"address2": "Building 3",
"city": "San Jose",
"state": "CA",
"zip": "95125",
"country": "US"
}
]

```

This endpoint will retrieve all warehouses created on your eBay account.

### HTTP Request

`GET https://api.sello.io/v5/market/ebay/{integration}/warehouses`

## Create an eBay Warehouse

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"name":"My warehouse" ... }' https://api.sello.io/v5/market/ebay/{integration}/warehouses
```

The above command will respond with status `201` and the id:

```
{
  "id": "default"
}
```

This endpoint will create a new warehouse on your eBay account.

### HTTP Request

`https://api.sello.io/v5/market/ebay/{integration}/warehouses`

## Get your eBay Policies

```

```

curl "https://api.sello.io/v5/market/ebay/{integration}/policies/{type}" -H "Authorization: meowmeowmeow"

```

When type is payment:

```

[
{
"name": "General policy",
"id": "5571768000",
"methods": [
{
"paymentMethodType": "PAYPAL",
"recipientAccountReference": {
"referenceType": "PAYPAL_EMAIL",
"referenceId": "support@sello.io"
}
}
]
}
]

```

When type is fulfillment:

```

[
{
"name": "Standard policy",
"id": "5570511000",
"handlingTime": {
"value": 1,
"unit": "DAY"
}
}
]

```

When type is return

```

[
{
"name": "Return policy",
"id": "5570529000",
"returnsAccepted": true,
"returnPeriod": {
"value": 30,
"unit": "DAY"
},
"returnShippingCostPayer": "SELLER"
}
]

```

This endpoint will retrieve all policies of a given type created on your eBay account.

### Payment Policies

`GET https://api.sello.io/v5/market/ebay/{integration}/policies/payment`

| Field | Description |
| name | Policy name (for interal use) |
| id | autogenerated id |
| methods | An array of payment methods. Currently the only supported method is `PAYPAL`. To enable paypal, you must also pass your Paypal e-mail address in the `recipientAccountReference` object. |

### Fulfillment Policies

`GET https://api.sello.io/v5/market/ebay/{integration}/policies/fulfillment`

| Field | Description |
| name | Policy name (for interal use) |
| id | autogenerated id |
| handlingTime | An object containing value and unit for handling time. The only supported unit is currently `DAY` |

### Return Policies

`GET https://api.sello.io/v5/market/ebay/{integration}/policies/return`

| Field | Description |
| name | Policy name (for interal use) |
| id | autogenerated id |
| returnsAccepted | A boolean if returns are accepted or not |
| returnPeriod | An object containing value and unit for return period. Acceptable values for `value` are 14, 30, 60. |
| returnShippingCostPayer | Either BUYER or SELLER |

## Create an eBay Policy

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"name":"My policy" ... }' https://api.sello.io/v5/market/ebay/{integration}/policies
```

The above command will respond with status `201` and the id:

```
{
  "id": "default"
}
```

This endpoint will create a new policy on your eBay account.

The payload should be constructed as the examples for `GET` above.

### HTTP Request

`https://api.sello.io/v5/market/ebay/{integration}/policies/{type}`

# Messages

## Getting number of unread messages

```

```

curl "https://api.sello.io/v5/messages/count" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"num": 192
}

```

This endpoint will return total number of unread messages.

### HTTP Request

`GET https://api.sello.io/v5/messages/count`

## Getting messages

```

```
curl "https://api.sello.io/v5/messages" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
{
    "total": 1,
    "messages": [
        {
            "account": 35648,
            "message": "Product description is too long, max length is 7000 chars.",
            "subject": "Too long description",
            "severity": "medium",
            "item_reference": "",
            "item_title": "Testing 123",
            "item_id": 35335339,
            "code": "TRADERA_TOO_LONG_DESCRIPTION",
            "type": "product",
            "integration": 36524,
            "market": 1,
            "new": true,
            "date": "2017-08-07T11:46:46.583Z",
            "timestamp": 1502106406583,
            "id": "AV28hM7U2qZ_2g5mdHSy"
        }
    ]
}
```

This endpoint will retrieve your last 100 messages. Messages are automatically purged after 14 days.

### HTTP Request

`GET https://api.sello.io/v5/messages`

### Pagination

To paginate, use `offset` to fetch messages by a different offset.

Examples:

Fetch messages 0-100:
`GET https://api.sello.io/v5/messages?offset=0`

Fetch messages 100-200:
`GET https://api.sello.io/v5/messages?offset=100`

Fetch messages 200-300:
`GET https://api.sello.io/v5/messages?offset=200`

### Filtering

The following fields supports filtering:

- severity

- type

- integration

To filter, add `filter[{filter name}]=value` to the url. You can add one or many filters at once. For example:

`GET https://api.sello.io/v5/messages?filter[type]=product&filter[integration]=382`

### Searching

To search, add `search={query}` to the url. For example:

`GET https://api.sello.io/v5/messages?search=stockholm`

## Set messages as read

```

```

curl -H "Authorization: meowmeowmeow" -X POST https://api.sello.io/v5/messages/read -d '{"ids":["id1", "id2"]}'

```

The above command will respond with status `200` if successful

This endpoint will set all supplied message id's as read.

### HTTP Request

`POST https://api.sello.io/v5/messages/read`

## Delete messages

```

```
curl -H "Authorization: meowmeowmeow" -X POST https://api.sello.io/v5/messages/delete -d '{"ids":["id1", "id2"]}'
```

The above command will respond with status `200` if successful

This endpoint will delete all supplied message id's.

### HTTP Request

`POST https://api.sello.io/v5/messages/delete`

# Orders

## Getting orders

```

```

curl "https://api.sello.io/v5/orders" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"meta": {
"total": 1
},
"orders": [
{
"id": 13901393,
"number": 865,
"status_id": 2591259,
"weight": 630,
"icons": [
"2"
],
"reminder_sent": false,
"integration_id": 0,
"market": 0,
"market_reference": "",
"created_at": "2016-12-14T10:41:40+01:00",
"delivered_at": null,
"updated_at": "2017-03-10T06:40:40+01:00",
"currency": "NOK",
"shipping_cost": 10,
"shipping_option": null,
"payment_option": null,
"total": 3071,
"total_eur": 337.81,
"customer_alias": "Nils 2017",
"customer_email": "nils@sello.io",
"customer_phone": "+467018388282",
"customer_mobile": "+467018388282",
"customer_first_name": "Nils",
"customer_last_name": "Muhrén",
"customer_address": "Kungsgatan 24",
"customer_address_2": "",
"customer_zip": "80292",
"customer_city": "Gävle",
"customer_country_code": "SE",
"is_deleted": false,
"is_active": true,
"is_paid": true,
"is_delivered": false,
"is_new": false,
"notes": "Riktigt bra kund",
"row_count": 5
}
]
}

```

This endpoint will retrieve up to 300 orders. The result will contain a limited set of attributes, to get all order information (including order rows), you need to fetch the order object using `GET https://api.sello.io/v5/orders/{orderId}`, see below for more information.

### HTTP Request

`GET https://api.sello.io/v5/orders`

### Data

| Parameter | Read only | Description |
| id | yes | Internal order id |
| number | yes | Customer order id |
| status_id | no | What status this order has |
| weight | yes | Total order weight in grams, calculated based on the purchased product's weights |
| icons | yes | An array of order icons (set by order reminder and order feedback) |
| reminder_sent | yes | Boolean if reminder has been sent. Set by order reminider |
| integration_id | yes | On what integration the order was made |
| market | yes | On what market the order was made |
| market_reference | yes | The market's reference (order id) for this order |
| created_at | yes | Timestamp when the order was created |
| delivered_at | yes | Timestamp when the order was delivered, set when you change the order status to a status that is set up to delivered=true |
| updated_at | yes | Timestamp when order was updated, set when an update is made on the order or order rows |
| currency | yes | Three char currency code |
| shipping_cost | no | Shipping cost in selected currency |
| shipping_option | no | What shipping option has been chosen |
| payment_option | no | What payment option has been chosen |
| total | yes | Order total in order currency, calculated on shipping cost + value of order rows |
| total_eur | yes | Order total, recalculated in Euro |
| customer_alias | no | Customer's alias |
| customer_email | no | Customer's email address |
| customer_phone | no | Customer's phone number |
| customer_mobile | no | Customer's mobile phone number |
| customer_first_name | no | Customer's first name |
| customer_last_name | no | Customer's last name |
| customer_address | no | Customer's address |
| customer_address_2 | no | Customer's address line 2 |
| customer_zip | no | Customer's zip code |
| customer_city | no | Customer's city |
| customer_country_code | no | Customer's 2-char country code |
| is_deleted | yes | Boolean if order is deleted (set when changing to an order status with deleted=true) |
| is_active | yes | Boolean if order is active (set when changing to an order status with active=true) |
| is_paid | yes | If order is paid (set when changing to an order status with active=true) |
| is_delivered | yes | Boolean if order is delivered (set when changing to an order status with delivered=true) |
| is_new | no | Boolean if the order is new (seen) or not |
| notes | no | A string of order notes |
| row_count | yes | Numeric value how many rows this order contains |

### Pagination

By default, 10 orders are returned per page. You may changing this by setting `size` to a value up to 300. To paginate, use `offset` to fetch orders by a different offset.

Examples:

Fetch orders 0-20:
`GET https://api.sello.io/v5/orders?size=20&offset=0`

Fetch orders 20-40:
`GET https://api.sello.io/v5/orders?size=20&offset=20`

Fetch orders 40-60:
`GET https://api.sello.io/v5/orders?size=20&offset=40`

### Sorting

The following fields supports sorting:

- customer_alias

- number

- weight

- total_eur

- created_at

- updated_at

- delivered_at

- row_count

To sort, append `sort` to the url and optional `sort_direction` (can be either `asc` or `desc`):

`GET https://api.sello.io/v5/orders?sort=customer_alias&sort_direction=desc`

### Filtering

The following fields supports filtering:

- customer_country_code

- is_deleted

- is_active

- is_delivered

- is_new

- is_paid

- status_id

- integration_id

To filter, add `filter[{filter name}]=value` to the url. You can add one or many filters at once. For example:

`GET https://api.sello.io/v5/orders?filter[customer_country_code]=NO&filter[status_id]=382`

### Searching

To search, add `search={query}` to the url. For example:

`GET https://api.sello.io/v5/orders?search=stockholm`

### Combining

You may combine sorting, filtering and searching at once. For example, to list all orders that are active, in Sweden, search of stockholm and sorted by weight descending:

`GET https://api.sello.io/v5/orders?filter[is_active]=true&filter[customer_country_code]=SE&search=stockholm&sort=weight&sort_direction=desc`

### Getting a single order

To fetch all data about an order, you may fetch it by requesting the order id:

`GET https://api.sello.io/v5/orders/{orderId}`

This will return some addiditional information compared to getting the list of orders:

| Parameter | Read only | Description |
| rows | yes | All order rows for this order |

## Add an order

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"integration_id":"4", "status_id": "123", "currency": "EUR"}' https://api.sello.io/v5/orders
```

The above command will respond with status `201` and return the created order id:

```
{
  "id": 14475806
}
```

This endpoint will add an order.

### HTTP Request

`POST https://api.sello.io/v5/orders`

### Supported parameters

| Parameter | Required? |
| customer_first_name | no |
| customer_last_name | no |
| customer_address | no |
| customer_address_2 | no |
| customer_zip | no |
| customer_city | no |
| customer_country_code | no |
| customer_alias | no |
| customer_email | no |
| customer_phone | no |
| customer_mobile | no |
| shipping_cost | no |
| notes | no |
| status_id | yes |
| market_reference | no |
| integration_id | yes |
| currency | yes |
| payment_option | no |
| shipping_option | no |
| created_at | no |

## Copy an order

```

```

curl -H "Authorization: meowmeowmeow" -X POST https://api.sello.io/v5/orders/{id}/copy

```

The above command will respond with status `201` and return the created order id:

```

{
"id": 14475806
}

```

This endpoint will copy an existing order. The resulting new order will be of type "own order" and with `integration_id` 0. This to indicate that the order isn't the original market's order but a copy.

### HTTP Request

`POST https://api.sello.io/v5/orders/{id}/copy`

## Merge orders

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"orders": [1, 2, 3]}' https://api.sello.io/v5/orders/{keepId}/merge
```

The above command will respond with status `200` if successful

Use this endpoint to merge orders. All orders in the array will be merged into order `keepId`. For example, if you have `keepId=123` and `orders=[123, 567, 987]`, then all order rows from order 567 and 987 will be added to 123 and orders 567 and 987 will be removed.

You are not allowed to merge orders with different currencies. If you attempt this, you will get `400 Bad Request`.

### HTTP Request

`POST https://api.sello.io/v5/orders/{keepId}/merge`

## Change an order

```

```

curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/orders/{id} -d '{"customer_alias":"New alias"}'

```

The above command will respond with status `200` if successful

This endpoint will update an order. Only send the attributes you wish to update, the other attributes will remain unchanged.

### HTTP Request

`PUT https://api.sello.io/v5/orders/{id}`

### Supported attributes

The following attributes may be updated, any other attributes will be silently ignored and unchanged.

- status_id

- shipping_cost

- shipping_option

- payment_option

- customer_alias

- customer_email

- customer_phone

- customer_mobile

- customer_first_name

- customer_last_name

- customer_address

- customer_address_2

- customer_zip

- customer_city

- customer_country_code

- is_new

- notes

## Change multiple orders

```

```
curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/orders -d '{"orders": [11, 22, 33], "changes": { "customer_alias":"New alias"}}'
```

The above command will respond with status `200` if successful

This endpoint will update a list of orders with the `changes` you supply. Only send the attributes you wish to update, the other attributes will remain unchanged. All changes supported by `PUT v5/orders/{id}` are supported in this call.

## Getting delivery notes

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '{"orders": [1, 2, 3]}' https://api.sello.io/v5/orders/deliverynotes

```

The above command will respond with status `201` if successful and a list of document url's

```

[
"https://files.sello.io/deliverynotes/42d2fd3b3f08cd4513f0380a2dd70d1fa2abebe1.pdf"
]

```

Generate delivery notes for the supplied order id's. You will normally receive one pdf file for each integration the orders are attached to. For example, if you supply 7 orders on one integration and 3 orders for another, you will receive 2 file url's.

### HTTP Request

`POST https://api.sello.io/v5/orders/deliverynotes`

## Getting delivery notes by market order number

```

```
curl -H "Authorization: meowmeowmeow" https://api.sello.io/v5/orders/ref/{market-order-number}/documents
```

The above command will respond with status `201` if successful and a list of document url's

```
[
  "https://files.sello.io/deliverynotes/42d2fd3b3f08cd4513f0380a2dd70d1fa2abebe1.pdf"
]
```

Generate delivery notes for the supplied market order number.

### HTTP Request

`GET https://api.sello.io/v5/orders/ref/{market-order-number}/documents`

## Getting order rows

```

```

curl "https://api.sello.io/v5/orders/{id}/rows" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

[
{
"id": "8109592",
"quantity": "2",
"title": "High quality watch",
"reference": "WTCH_3829",
"price": "100",
"stock_location": "Shelf 8",
"item_no": "124",
"tax": "25.00",
"created_at": "2016-12-14 10:53:09",
"product_id": "29372618",
"integration_id": "9472",
"identifier": "51748283",
"identifier_type": "EAN",
"total_weight": 282,
"submitter": "9",
"purchase_price": "10",
"tradera_order_id": null,
"total_vat": 440
}
]

```

This endpoint will retrieve an array of all order rows for specified order.

### HTTP Request

`GET https://api.sello.io/v5/orders/{id}/rows`

### Data

| Parameter | Description |
| id | Order row id (read only) |
| quantity | How many was purchased |
| title | Row title |
| reference | Your product reference (private SKU) |
| price | Price/each in order currency |
| stock_location | Product location (read only), fetched from product object |
| item_no | External item no, for example auction id or webshop product id |
| tax | Tax rate |
| created_at | Timestamp when product was created (read only) |
| product_id | Sello product id |
| integration_id | On what integration the order was made |
| identifier | Identifier number (EAN, GTIN, UPC, ISBN) |
| identifier_type | Type of identifier |
| total_weight | Total weight (product weight &times; quantity) in grams. Read only, fetched from product |
| submitter | Submitter id (see submitters) |
| purchase_price | Total purchase price. Read only, fetched from product |
| tradera_order_id | Tradera's order id (if any) |
| total_vat | Total VAT for this row |

## Add an order row

```

10,
"title" => "My order row title",
"reference" => "Product SKU",
"price" => 50,
"item_no" => "123",
"tax" => 25,
"integration_id" => 4,
"product_id" => 1893372
]
));
curl_setopt($handle, CURLOPT_HTTPHEADER, [
'Accept: application/json',
'Content-Type: application/json',
'Authorization: meowmeowmeow'
]);

$response = curl_exec($handle);
$code = curl_getinfo($handle, CURLINFO_HTTP_CODE);

echo "Code: $code, response: $response";

```

```

curl "https://api.sello.io/v5/orders/{id}/rows" -H "Authorization: meowmeowmeow" -X POST -d '{"quantity": 10, "title": "My order row title", "reference": "Product SKU", "price": 50, "item_no": "123", "tax": 25, "integration_id": 4, "product_id": 1893372}'

```

The above command returns the added row like this:

```

[
{
"id": "8109592",
"quantity": "10",
"title": "My order row title",
"reference": "Product SKU",
"price": "50",
"stock_location": "Shelf 8",
"item_no": "123",
"tax": "25.00",
"created_at": "2016-12-14 10:53:09",
"product_id": "1893372",
"integration_id": "9472",
"identifier": "51748283",
"identifier_type": "EAN",
"total_weight": 282,
"submitter": null,
"purchase_price": "10",
"tradera_order_id": null,
"total_vat": 440
}
]

```

This endpoint will add an order row to an existing order.

Required fields are:

- quantity

- title

- price

- tax

### HTTP Request

`POST https://api.sello.io/v5/orders/{id}/rows`

## Change an order row

```

```
curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/orders/{id}/rows/{rowId} -d '{"title":"New title"}'
```

The above command will return the updated row:

```
[
  {
    "id": "8109592",
    "quantity": "2",
    "title": "New title",
    "reference": "WTCH_3829",
    "price": "100",
    "stock_location": "Shelf 8",
    "item_no": "124",
    "tax": "25.00",
    "created_at": "2016-12-14 10:53:09",
    "product_id": "29372618",
    "integration_id": "9472",
    "identifier": "51748283",
    "identifier_type": "EAN",
    "total_weight": 282,
    "submitter": "9",
    "purchase_price": "10",
    "tradera_order_id": null,
    "total_vat": 440
  }
]
```

This endpoint will allow you to update an order row.

### HTTP Request

`PUT https://api.sello.io/v5/orders/{id}/rows/{rowId}`

### Data

The following attributes may be updated:

- quantity

- title

- reference

- price

- stock_location

- item_no

- tax

- product_id

## Create/update order row return

```

```

curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/orders/{id}/rows/{rowId} -d '{"status":"accepted","status_reason":"Wrong size","status_updated":"2023-02-22T11:00:00Z","quantity_returned":1}'

```

The above command will return the updated row:

```

{
"message": "Return updated"
}

```

This endpoint allows you to create or update a return on an order row.

To create a return you must first send an initial update with status `return_pending`, this is to register the initial return in Sello and on marketplaces that support order returns.

After the return is registered in Sello you can update the status with the final status of `return_accepted` or `return_denied`, which will then be sent to marketplaces that suport returns.

### HTTP Request

`PUT https://api.sello.io/v5/orders/{orderId}/rows/{rowId}/return`

### Data

| Parameter | Required | Description |
| status | yes | Return status (one of: "return_pending", "return_accepted", "return_declined") |
| status_reason | yes | Reason for return (max 100 characters) |
| quantity_returned | yes | Returned product quantity |

### Marketplace specific return reasons

On some marketplace, you MUST use specific `status_reason` values, which are listed below.

| Marketplace | status_reason value | Description |
| Zalando | reason_0 | Unknown |
| Zalando | reason_1 | It doesn't suit me |
| Zalando | reason_2 | Too big |
| Zalando | reason_3 | Too small |
| Zalando | reason_4 | Insufficient quality |
| Zalando | reason_5 | Arrived too late |
| Zalando | reason_6 | Not as expected |
| Zalando | reason_9 | Incorrect article |
| Zalando | reason_10 | Faulty |

### Errors

| Status code | Message | Reason |
| 400 | Won't register return since current status is {current} and want to change to {new} | Not allowed to change return status |
| 404 | No such order found | Order not found in your Sello account |
| 404 | No such order row | Order row not found on specified Sello order |

## Delete an order row

```

```
curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/orders/{id}/rows/{rowId} -X 'DELETE'
```

The above command will return status 204

This endpoint will allow you to remove an order row.

### HTTP Request

`DELETE https://api.sello.io/v5/orders/{id}/rows/{rowId}`

## Separate an order row

```

```

curl "https://api.sello.io/v5/orders/{id}/rows/{rowId}/separate" -H "Authorization: meowmeowmeow" -X POST -d '{"quantity": 10, "title": "My order row title", "reference": "Product SKU", "price": 50, "item_no": "123", "tax": 25, "integration_id": 4, "product_id": 1893372}'

```

The above command returns 201 and the id of the newly created order like this:

```

{
"id": "8109592"
}

```

This endpoint will separate an order row from the current order into a new order.

### HTTP Request

`POST https://api.sello.io/v5/orders/{id}/rows/{rowId}/separate`

## Get order deliveries

```

```
curl "https://api.sello.io/v5/orders/{id}/deliveries" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
{
  "deliveries": [
    {
      "id": "UA912821763",
      "method": "posten",
      "documents": [
        "https://documents.sello.io/deliveries/k3294k2194812j2k59c8xt2f1d1648dja.pdf"
      ]
    },
    {
      "id": "UA836194721",
      "method": "posten",
      "documents": []
    }
  ]
}
```

This endpoint will retrieve all available order deliveries for an order. The result will contain tracking id's and any associated documents.

### HTTP Request

`GET https://api.sello.io/v5/orders/{id}/deliveries`

## Add order delivery

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '{"id":"UU3918661", "method": "posten", "documents": ["https://documents.sello.io/deliveries/k3294k2194812j2k59c8xt2f1d1648dja.pdf"]}' https://api.sello.io/v5/orders/{id}/deliveries

```

The above command will respond with status `201` and return the created delivery:

```

{
"id": "UU3918661",
"method": "posten",
"documents": [
"https://documents.sello.io/deliveries/k3294k2194812j2k59c8xt2f1d1648dja.pdf"
]
}

```

This endpoint will add an order delivery to the order. The `id` must be unique. If it already exist on the order, it will be overwritten.

### HTTP Request

`POST https://api.sello.io/v5/orders/{id}/deliveries`

### Data

| Parameter | Required? | Description |
| id | yes | Tracking id for the delivery |
| method | yes | Valid values are any of: dhl, bring, bussgods, posten, posti, schenker, gls, skynet, ups, dpd, dsv, tnt, fedex, itella, postenaland, other |
| documents | no | An array of links to documents associated with this delivery |

## Remove an order delivery

```

```
curl -H "Authorization: meowmeowmeow" -X DELETE https://api.sello.io/v5/orders/{orderId}/deliveries/{id}
```

The above command will respond with status `204` if successful

This endpoint will remove an order delivery from the order. Please note that if the order has been set as delivered and thereby the delivery id's have been synced to marketplaces, then removing the id's won't remove them from the marketplaces.

### HTTP Request

`DELETE https://api.sello.io/v5/orders/{orderId}/deliveries/{id}`

### Data

| Parameter | Required? | Description |
| id | yes | Tracking id for the delivery |

## Get order history

```

```

curl "https://api.sello.io/v5/orders/{id}/history" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"history": [
{
"time": "2016-12-09T09:21:07+00:00",
"message": "History message 12"
},
{
"time": "2016-12-09T09:21:06+00:00",
"message": "History message 11"
},
{
"time": "2016-12-09T09:21:04+00:00",
"message": "History message 10"
},
{
"time": "2016-12-09T09:21:03+00:00",
"message": "History message 9"
},
{
"time": "2016-12-09T09:21:01+00:00",
"message": "History message 8"
},
{
"time": "2016-12-09T09:20:59+00:00",
"message": "History message 7"
},
{
"time": "2016-12-09T09:20:56+00:00",
"message": "History message 6"
},
{
"time": "2016-12-09T09:20:55+00:00",
"message": "History message 5"
},
{
"time": "2016-12-09T09:20:54+00:00",
"message": "History message 4"
},
{
"time": "2016-12-09T09:20:52+00:00",
"message": "History message 3"
}
],
"next": "1481275252670"
}

```

This endpoint will retrieve 10 order history items with timestamp and message. If there is more than 10 history items on an order, you will also retrieve a value for `next`. To fetch more messages, you use this value to fetch an addidional 10 items.

The timestamps returned are UTC.

### HTTP Request

`GET https://api.sello.io/v5/orders/{id}/history`

### Query Parameters

| Parameter | Default | Description |
| next | empty | Leave empty to fetch the 10 latest items, or use a token for a previous request to fetch an additional 10 items. |

## Make receipts

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"orders":[123, 456, 789]}' https://api.sello.io/v5/orders/receipts
```

The above command will respond with status `201` and return the created pdf file:

```
{
  "url": [
    "https://documents.sello.io/receipts/k3294k2194812j2k59c8xt2f1d1648dja.pdf"
  ]
}
```

This endpoint will generate receipts for all supplied orders and return an url to the PDF receipt.

### HTTP Request

`POST https://api.sello.io/v5/orders/receipts`

## Make Trading documents

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '{"orders":[123, 456, 789]}' https://api.sello.io/v5/orders/tradingdocs

```

The above command will respond with status `201` and return the created pdf file:

```

{
"url": [
"https://documents.sello.io/tradingdocs/k3294k2194812j2k59c8xt2f1d1648dja.pdf"
]
}

```

This endpoint will generate docs for all supplied orders and return an url to the PDF document.

### HTTP Request

`POST https://api.sello.io/v5/orders/tradingdocs`

# Products

## Getting products

```

```
curl "https://api.sello.io/v5/products" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
{
  "statusCode": 200,
  "data": {
    "meta": {
      "total": 1
    },
    "products": [
      {
        "id": 3635056,
        "folder_id": 1032767,
        "folder_name": "Parfym för henne",
        "brand_id": "434",
        "brand_name": "Versace",
        "condition": "new",
        "tax": "25",
        "group_id": 2224433,
        "private_name": "Versace Bright Crystal Edt 50ml",
        "private_reference": "PVE002",
        "quantity": 10,
        "stock_location": "PVE002",
        "created_at": "2014-12-03T00:00:00.000Z",
        "updated_at": null,
        "volume": 0,
        "volume_unit": "m3",
        "weight": 250,
        "purchase_price": 391,
        "notes": "",
        "sold": 108,
        "unsold": 0,
        "last_sold": "2017-08-07T00:00:00.000Z",
        "shipping": {
          "10108": {
            "posten": "0.00",
            "dhl": null,
            "bussgods": null,
            "schenker": null,
            "other": null,
            "pickup": false
          },
          "13159": {
            "SE": "H",
            "DK": "B",
            "FI": "B",
            "NO": "B"
          }
        },
        "prices": {
          "10108": {
            "store": "489",
            "auction": {
              "start": 0,
              "buynow": 0,
              "reserve": 0
            }
          },
          "13159": {
            "SE": {
              "store": null,
              "regular": null
            },
            "NO": {
              "store": "479",
              "regular": "695"
            },
            "DK": {
              "store": "369",
              "regular": "546"
            },
            "FI": {
              "store": "48.95",
              "regular": "73.25"
            }
          },
          "14333": {
            "sv": {
              "store": "695",
              "campaign": "479"
            }
          },
          "14803": {
            "sv": {
              "store": "489",
              "regular": "695"
            }
          },
          "32777": {
            "sv": {
              "store": null,
              "campaign": null
            }
          },
          "32778": {
            "sv": {
              "store": null,
              "campaign": null
            }
          },
          "32978": {
            "sv": {
              "store": "695",
              "campaign": "689"
            }
          },
          "33448": {
            "store": null,
            "campaign": null
          },
          "35043": {
            "sv": {
              "store": "695",
              "campaign": "377"
            }
          },
          "37196": {
            "store": "695",
            "campaign": "499"
          },
          "37410": {
            "store": null,
            "campaign": null
          },
          "37411": {
            "store": null,
            "campaign": null
          },
          "37412": {
            "store": null,
            "campaign": null
          },
          "37413": {
            "store": null,
            "campaign": null
          },
          "37937": {
            "store": null,
            "campaign": null
          },
          "37938": {
            "store": null,
            "campaign": null
          },
          "37939": {
            "store": null,
            "campaign": null
          },
          "38071": {
            "sv": {
              "store": "695",
              "campaign": "479"
            }
          },
          "default": {
            "calculate": false,
            "adjust": false,
            "minimum_price": "",
            "target_price": "",
            "recommended_price": ""
          }
        },
        "texts": {
          "default": {
            "be": {
              "name": "Versace Bright Crystal Edt 50ml"
            },
            "da": {
              "name": "Versace Bright Crystal Edt 50ml"
            },
            "de": {
              "name": "Versace Bright Crystal Edt 50ml"
            },
            "en": {
              "name": "Versace Bright Crystal Edt 50ml"
            },
            "es": {
              "name": "Versace Bright Crystal Edt 50ml"
            },
            "fi": {
              "name": "Versace Bright Crystal Edt 50ml"
            },
            "fr": {
              "name": "Versace Bright Crystal Edt 50ml"
            },
            "it": {
              "name": "Versace Bright Crystal Edt 50ml"
            },
            "no": {
              "name": "Versace Bright Crystal Edt 50ml"
            },
            "sv": {
              "name": "Versace Bright Crystal Edt 50ml"
            }
          }
        },
        "categories": {
          "10108": [
            {
              "id": "161202"
            }
          ],
          "13159": [
            {
              "id": "319"
            }
          ],
          "14333": [
            {
              "id": "41"
            }
          ],
          "14803": [
            {
              "id": "617"
            }
          ],
          "32777": [
            {
              "id": null
            }
          ],
          "32778": [
            {
              "id": null
            }
          ],
          "32978": [
            {
              "id": null
            }
          ],
          "33448": [
            {
              "id": null
            }
          ],
          "35043": [
            {
              "id": null
            }
          ],
          "37196": [
            {
              "id": null
            }
          ],
          "37410": [
            {
              "id": "8049"
            }
          ],
          "37411": [
            {
              "id": null
            }
          ],
          "37412": [
            {
              "id": null
            }
          ],
          "37413": [
            {
              "id": null
            }
          ],
          "37937": [
            {
              "id": null
            }
          ],
          "37938": [
            {
              "id": null
            }
          ],
          "37939": [
            {
              "id": null
            }
          ],
          "38071": [
            {
              "id": "70"
            }
          ],
          "default": {
            "id": "161202"
          }
        },
        "integrations": {
          "10108": {
            "active": true,
            "item_id": 227622317
          },
          "13159": {
            "active": true,
            "item_id": 1
          },
          "14333": {
            "active": true,
            "item_id": 432
          },
          "14803": {
            "active": true,
            "item_id": 0
          },
          "32777": {
            "active": false,
            "item_id": 0
          },
          "32778": {
            "active": false,
            "item_id": 0
          },
          "32978": {
            "active": true,
            "item_id": 162
          },
          "33448": {
            "active": false,
            "item_id": 0
          },
          "35043": {
            "active": true,
            "item_id": 262
          },
          "37196": {
            "active": true,
            "item_id": 1
          },
          "37410": {
            "active": false,
            "item_id": 0
          },
          "37411": {
            "active": false,
            "item_id": 0
          },
          "37412": {
            "active": false,
            "item_id": 0
          },
          "37413": {
            "active": false,
            "item_id": 0
          },
          "37937": {
            "active": false,
            "item_id": 0
          },
          "37938": {
            "active": false,
            "item_id": 0
          },
          "37939": {
            "active": false,
            "item_id": 0
          },
          "38071": {
            "active": true,
            "item_id": 384
          }
        },
        "properties": [
          {
            "property": "EAN",
            "value": {
              "default": "8011003993819"
            }
          }
        ],
        "auctions": {
          "10108": {
            "auctions": ["121429449", "83719402"]
          }
        },
        "images": [
          {
            "id": 27507965,
            "url_large": "https://images.sello.io/item/98/50258-original.jpg",
            "url_small": "https://images.sello.io/item/98/50258-shop.jpg"
          }
        ]
      }
    ],
    "groups": [
      {
        "id": 123,
        "products": [1, 2, 3],
        "main_product": 3
      }
    ]
  }
}
```

This endpoint will retrieve up to 100 products. The result will contain a limited set of attributes, to get all product information, you need to fetch the product object using `GET https://api.sello.io/v5/products/{productId}` or `GET https://api.sello.io/v5/products/sku/{sku}`, see below for more information.

Additionally, a `groups` array is included in the response. If any product in the result is placed in a group with more than 1 product, that group will be specified with a list of products and what product is tha main product in the group.

### HTTP Request

`GET https://api.sello.io/v5/products` to fetch multiple products

`GET https://api.sello.io/v5/products/{id}` to fetch single product by id

`GET https://api.sello.io/v5/products/sku/{sku}` to fetch single product by SKU

### Data

| Parameter | Read only | Description |
| id | yes | Internal product id |
| folder_id | no | In what folder this product is placed |
| folder_name | yes | The name of the selected folder (based on folder_id) |
| brand_id | no | Product's brand id |
| brand_name | yes | The name of the selected brand (based on brand_id) |
| condition | no | Must be either new or used |
| tax | no | valid values are 0, 6, 12, 25 |
| group_id | yes | What group the product belongs to |
| private_name | no | Your own internal product name (not exposed to customer) |
| private_reference | no | Your product SKU or reference |
| quantity | no | How many you have in stock of this product |
| stock_location | no | The location where these items are located |
| created_at | yes | When the product was created |
| updated_at | yes | When the product was last updated |
| volume | no | Product volume |
| volume_unit | no | Unit for volume |
| weight | no | Weight in gram |
| purchase_price | no | Your purchase price, this will be used to generate stats (earnings etc.) |
| notes | no | Misc product notes |
| sold | yes | How many have been sold of this item |
| unsold | yes | How many time you have had an auction unsold on this item (only applies to Tradera) |
| last_sold | yes | When the product was last sold |
| shipping | no | An object with integration id's as key, and object representing shipping cost for that integration |
| prices | no | An object with integration id's as key, and object representing product price on that integration |
| prices.default | no | The default price for this product. By setting calculate=true, the price set as target_price will be converted to repective integration's currency and override any per-integration prices. "adjust" is an experimental feature and not currently recommended for public use. |
| texts | no | See separate section below about the texts object. When listing products, only `name` for each language will be available. To get the complete text object, please fetch the full product data. |
| categories | no | An object with integration id's as key and an array of category id's for that integration. Please note that currently only Woocommerce, Prestashop and SelloShop support multiple category id's. |
| categories.defaultl | no | The default Sello category id. This will be used to try to map a marketplace category to your product. |
| integrations | no | An object with integration id's as key and object with two values; active true/false - if the product should be for sale on this channel or not. item_id (read only) - marketplace product identifier. |
| properties | no | An array of product properties and their values. See "Get available product properties" section. The value is an object with language code as key for localized values. You are also encouraged to supply "default" as the default value that will be used if a localized value isn't present for a specific language. In product list, only EAN, GTIN, UPC and ISBN are available - to get all properties you need to fetch the full product data. |
| auctions | yes | An object with integration id as key. The auctions array contains active auction id's for that integration. |
| images | yes | An array with image objects. See section below about adding |

### Texts

Example texts object

```
{
  "texts": {
    "default": {
      "en": {
        "name": "Product name",
        "description": "
My product name
",
        "title": "",
        "meta_description": "",
        "meta_keywords": "",
        "bulletpoints": ["Great price", "Fast delivery", "24k Gold"]
      },
      "sv": {
        "use": "en"
      },
      "no": {
        "use": "sv"
      }
    },
    "36526": {
      "no": {
        "name": "My norwegian name",
        "description": "My Norwegian description, this will only be used for integration 36526",
        "title": "My title",
        "meta_description": "My meta description",
        "meta_keywords": "My meta keywords",
        "bulletpoints": ["Bullet 1", "Bullet 2"]
      }
    }
  }
}
```

Texts have two parts; default texts and integration-specific texts. If no specific text exists for an integration, the default text for the integration's language will be used.

You specify default texts for each language you want to support. It's highly recommended to supply an english text since it will be our primary fallback if a default text in a specific language doesn't exist.
You can either specify `use` to tell us to use another default text for that language, or specify the actual text details.

### Pagination

By default, 100 products are returned per page. You may lowering this by setting `size` to a value up to 100. Values above 100 will automatically be reset to 100. To paginate, use `offset` to fetch products by a different offset.

Examples:

Fetch products 0-20:
`GET https://api.sello.io/v5/products?size=20&offset=0`

Fetch products 20-40:
`GET https://api.sello.io/v5/products?size=20&offset=20`

Fetch products 40-60:
`GET https://api.sello.io/v5/products?size=20&offset=40`

### Sorting

The following expressions are valid values for sorting. Curly braces means that you should replace this with your language/integration id etc.

- texts.default.{language}.name

- categories.{integrationId}.name

- shipping.{integrationId}.{method}

- prices.{integrationId}.{type} (type can be store, regular, campaign, auction.start, auction.buynow, auction.reserve)

- folder_name

- brand_name

- condition

- tax

- group_id

- private_name

- private_reference

- quantity

- stock_location

- created_at

- updated_at

- volume

- volume_unit

- weight

- purchase_price

- notes

- sold

- unsold

- last_sold

To sort, append `sort` to the url and optional `sort_direction` (`desc` by default. Can be either `asc` or `desc`):

`GET https://api.sello.io/v5/products?sort=prices.4.store&sort_direction=asc`

### Filtering

The following fields supports filtering:

- integrations.{integrationId}.active

- folder_id

- private_reference

- quantity

- private_name

- last_sold

- prices.default.calculate

- prices.default.adjust

To filter, add `filter[{filter name}]=value` to the url. You can add one or many filters at once.

Quantity and last_sold also support ranges. This means you can use gt (greater than) and lt (less than) to improve filtering. For example, to filter products with less than 10 in quantity you do `filter[quantity]=lt 10`. To filter products that have been sold after 2017-01-01, you do `filter[last_sold]=gt 2017-01-01`.

For example filtering by quantity more than 20 and folder_id 0:

`GET https://api.sello.io/v5/products?filter[quantity]=gt 20&filter[folder_id]=0`

Filtering by multiple values

You may filter by multipe values - ie find products with a list of references by supplying an array of values:

`GET https://api.sello.io/v5/products?filter[id][]=1&filter[id][]=2&filter[id][]=3`

### Searching

To search, add `search={query}` to the url. For example:

`GET https://api.sello.io/v5/products?search=stockholm`

### Combining

You may combine sorting, filtering and searching at once. For example, to list all products that are active on integration 4, in folder 0, search of Pokemon and sorted by weight descending:

`GET https://api.sello.io/v5/products?filter[integrations.4.active]=true&filter[folder_id]=0&search=Pokemon&sort=weight&sort_direction=desc`

### Getting a single product

To fetch all data about a product, you may fetch it by requesting the product id:

`GET https://api.sello.io/v5/products/{productId}`

This will return some addiditional information compared to getting the list of products:

| Parameter | Read only | Description |
| tax_class | No | This is an upcoming feature. Will be documented as soon as it's generally available |
| quantity_threshold | No | At what quantity we should send mail about quantity being low on product |
| manufacturer | No | Manufacturer id |
| manufacturer_no | No | Manufacturer number |
| submitter_id | No | The id of the submitter that submitted this product (only available for Sales Agents) |
| texts | No | This will include the complete texts object and settings for each integration. See separate section in text object above. |
| prices | No | Price objects will include `currency` where available |
| delivery_times | No | An object with region and it's min/max delivery time. Currently only `default` is supported, further support will be announced soon. |
| categories | No | Categories will additionally include name, crumb and crumb_array - all of these attributes are read-only. |
| integrations | No | Each integration will include an `extra` attribute. This is currently only for internal use. |
| properties | No | All properties will be returned. In product list, only EAN, GTIN, UPC and ISBN are available. |

There are also a few fields that aren't available when you fetch a single product but is in product list:

- folder_name

- brand_name

- auctions

## Add a product

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '{"private_reference":"REF-3", "folder_id": "123"}' https://api.sello.io/v5/products

```

The above command will respond with status `201` and return the created product data:

```

{
"id": 14475806,
"private_reference": "REF-3"
...
}

```

This endpoint will add a product.

### HTTP Request

`POST https://api.sello.io/v5/products`

### Supported parameters

All attributes available when you GET a product is also supported when you create a new product.

## Copy a product

```

```
curl -H "Authorization: meowmeowmeow" -X POST https://api.sello.io/v5/products/{id}/copy
```

The above command will respond with status `201` and return the created product data:

```
{
  "id": 14475806,
  "private_name": "Pokemon Cards"
  ...
}
```

This endpoint will copy an existing product.

### HTTP Request

`POST https://api.sello.io/v5/products/{id}/copy`

## Change a product

```

```

curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/products/{id} -d '{"private_name":"New private name"}'

```

The above command will respond with status `200` if successful

This endpoint will update a product. Only send the attributes you wish to update, the other attributes will remain unchanged. When updated, product will be queued for syncing changes to all activated marketplaces.

### HTTP Request

`PUT https://api.sello.io/v5/products/{id}` or `PUT https://api.sello.io/v5/products/sku/{sku}`

## Delete a product

```

```
curl -H "Authorization: meowmeowmeow" -X DELETE https://api.sello.io/v5/products/{id}
```

The above command will respond with status `202` if successful

This endpoint will add a product to queue for deletion. When processed, the product will be permanently removed from Sello and all enabled marketplaces. It is not possible to recover a deleted product.

### HTTP Request

`DELETE https://api.sello.io/v5/products/{id}` or `DELETE https://api.sello.io/v5/products/sku/{sku}`

## Add images

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '{"urls":["https://i.vimeocdn.com/portrait/58832_300x300"]}' https://api.sello.io/v5/products/1234/images

```

The above command will respond with status `201` and return the updated product data

This endpoint will add images to a product.

### HTTP Request

`POST https://api.sello.io/v5/products/{id}/images`

### Supported parameters

`urls`: A list of image URL's. The first image in the array will be used as the main image for the product if no other images on the product exists. The images you supply will replace any current images on the product.

To prevent duplicates, Sello will check your image URL's and make sure that they don't already exist on the product. If they do, we'll return the data for that image.

## Delete an image

```

```
curl -H "Authorization: meowmeowmeow" -X DELETE https://api.sello.io/v5/products/{id}/images/{imageId}
```

The above command will respond with status `200` if successful

This endpoint will permanently remove a product image. When processed, the image will be permanently removed from Sello and all enabled marketplaces. It is not possible to recover a deleted image.

### HTTP Request

`DELETE https://api.sello.io/v5/products/{id}/images/{imageId}`

## Change cover image

```

```

curl -H "Authorization: meowmeowmeow" -X POST https://api.sello.io/v5/products/{id}/images/{imageId}/cover

```

The above command will respond with status `200` upon success

This endpoint will set the supplied image id as cover image of the product.

### HTTP Request

`POST https://api.sello.io/v5/products/{id}/images/{imageId}/cover`

## Bulk-editing products

```

```
curl -H "Authorization: meowmeowmeow" -X PUT -d '{"products":["31662149","31662150"],"data":{"texts":{"99":{"sv":{"name":"New product name"}}}}}' https://api.sello.io/v5/products/bulk
```

The above command will respond with status `202` and process your request in queue

This endpoint is used to update multiple products (up to 100) with the same information. For example, if you want to set the same name or properties on multiple products, this is the endpoint for you.

### HTTP Request

`PUT https://api.sello.io/v5/products/bulk`

### Data

| Parameter | Required? | Description |
| products | yes | An array of product id's to update |
| data | yes | The new product data. This uses the same format as when you GET a product. Please only send the data you want to change and not the complete product object. |

## Get product history

```

```

curl "https://api.sello.io/v5/products/{id}/history" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"history": [
{
"time": "2017-02-24T11:57:00+00:00",
"message": "Generic message",
"code": "123",
"params": {
"foo": "bar"
}
},
{
"time": "2017-02-24T11:56:57+00:00",
"message": "Generic message",
"code": "456",
"params": {
"foo": "bar"
}
}
],
"next": "1481275252670"
}

```

This endpoint will retrieve 20 product history items with timestamp, history code, params and message. If there is more than 20 history items on a product, you will also retrieve a value for `next`. To fetch more messages, you use this value to fetch an addidional 20 items.

The timestamps returned are UTC.

### HTTP Request

`GET https://api.sello.io/v5/products/{id}/history`

### Query Parameters

| Parameter | Default | Description |
| next | empty | Leave empty to fetch the 20 latest items, or use a token for a previous request to fetch an additional 20 items. |

### Supported history codes

| Code | Params | Message |
| 0 | - | The item has no code or params. Legacy history item, just show the message |
| 101 | {"quantity": 20} | Updating product quantity to 20 |
| 102 | {"auction": 123} | Closing auction 123 on Tradera |
| 103 | {"auction": 123} | Created auction 123 on Tradera |
| 104 | {"id": 123} | Created store item 123 on Tradera |
| 105 | {"auction": 123} | Auction 123 was unsold on Tradera. Increasing stock. |
| 106 | {"quantity": 4} | 4 items sold in Selloshop |
| 107 | - | Could not create auction on Tradera |
| 108 | {"date": "2017-02-24T15:12:13+01:00"} | Adding auction to be created at 2017-02-24T15:12:13+01:00 |
| 109 | {"id": 4} | Added to Prestashop, got id: 4 |
| 110 | {"quantity": 4} | 4 items sold in Woocommerce |
| 111 | {"quantity": 4, "id": 123} | 4 items sold on Tradera order 123 |
| 112 | {"quantity": 4, "id": 123} | 4 items sold on Prestashop order 123 |
| 113 | {"quantity": 4, "id": 123} | 4 items sold on Fyndiq order 123 |
| 114 | {"quantity": 4, "id": 123} | 4 items sold on CDON order 123 |
| 115 | {"quantity": 4, "id": 123} | 4 items sold on Amazon33650556 order 123 |

## Get available product properties

```

```
curl "https://api.sello.io/v5/products/properties" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
[
  {
    "id": "MaximumManufacturerWeightRecommended",
    "name": "Maximum manufacturer weight recommended",
    "type": "text"
  },
  {
    "id": "MaximumManufacturerAgeRecommended",
    "name": "Maximum manufacturer age recommended",
    "type": "text"
  },
  {
    "id": "MinimumWeightRecommendation",
    "name": "Minimum weight recommendation",
    "type": "text"
  },
  {
    "id": "CountryAsLabeled",
    "name": "Country as labeled",
    "type": "text"
  },
  {
    "id": "Battery",
    "name": "Battery",
    "type": "text"
  }
]
```

This endpoint will retrieve up to 10 properties. Use `offset` to paginate.

### HTTP Request

`GET https://api.sello.io/v5/products/properties`

### Data

| Parameter | Description |
| id | Property id, to be submitted to product resource |
| name | Friendly translated property name (use `Accept-language` to determine language) |
| type | either `text` = Any text input is valid or `enum` |
| values | only available if type is `enum`. You must specify any of the specified values when you save your product. |

### Pagination

By default, 10 properties are returned per page. You may changing this by setting `size` to a value up to 100. To paginate, use `offset` to fetch properties by a different offset.

Examples:

Fetch properties 0-20:
`GET https://api.sello.io/v5/products/properties?size=20&offset=0`

Fetch properties 20-40:
`GET https://api.sello.io/v5/products/properties?size=20&offset=20`

Fetch properties 40-60:
`GET https://api.sello.io/v5/products/properties?size=20&offset=40`

### Getting specific properties

You may choose to filter by specific property names by adding a comma-separated list of property name. For example, if you are only interested in Color and Material properties, you could do a query like:

`GET https://api.sello.io/v5/products/properties?filter[id]=Color,Material`

### Searching

To search, add `search={query}` to the url. For example:

`GET https://api.sello.io/v5/products/properties?search=shape`

## Get required and recommended properties for a certain category

```
 ['4' => ['1', '2']]]));
curl_setopt($handle, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'Content-Type: application/json',
    'Authorization: meowmeowmeow'
]);

$response = curl_exec($handle);
$code = curl_getinfo($handle, CURLINFO_HTTP_CODE);

echo "Code: $code, response: $response";
```

Example payload:

```
{
  "categories": {
    "4": [ "344361" ],
    "32185": [ "2920" ],
    "33063": [ null ],
    "36363": [ "3237" ],
    "37199": [ "8787" ],
    "37716": [ "2070" ]
  }
}
```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"categories":{"4": ["1", "2"]}}' https://api.sello.io/v5/products/properties/required
```

The above command returns JSON structured like this:

```
{
  "required": ["Color", "Material"],
  "recommended": ["ColorPattern"]
}
```

This endpoint will an array of required respective recommended properties for the specified categories.

### HTTP Request

`POST https://api.sello.io/v5/products/properties/required`

### Data

The payload should be specified as an object with integration id's as the key and an array of category id's as the value. In the example payload, integration id 4 has one category specified - 344361.

## Create stock value document

```

```

curl -H "Authorization: meowmeowmeow" -X POST https://api.sello.io/v5/products/value

```

The above command will respond with status `201` and return the created order id:

```

{
"url": "https://files.sello.io/438jd0d9dh2ksd09f.xlsx"
}

```

This endpoint will generate stock value document in xlsx format.

# Product map API

This API is designed to simplify the integration of product data. Simply PUT your product data in JSON format, and we’ll handle the mapping on our end. This enterprise feature requires a separate agreement. Please contact Sales for more information.

## Submit product data

Use this endpoint to submit your product data in JSON format, following the schema agreed upon with your Onboarding Agent. Once data is submitted to the endpoint, your request will be queued and processed later. Please ensure you only use this endpoint when there are actual changes to your product data.

```

```
curl -H "Authorization: meowmeowmeow" -X PUT -d '{"name":"Cool t-shirt", "size": "XXL"}' https://api.sello.io/v5/products/mapped/{integrationId}/{parentSku}/{sku}/update
```

The above command will respond with status `202`.

```
{
  "shipping_tax": "25",
  "mail_send_copy": "1"
}
```

### HTTP Request

`PUT https://api.sello.io/v5/products/mapped/{integrationId}/{parentSku}/{sku}/update`

| Parameter | Max length | Description |
| integrationId | - | Internal integration id. This will be provided by your Onboarding Agent |
| parentSku | 40 | The SKU grouping multiple SKU's. Se example below |
| sku | 40 | The SKU of the size/color/model. IMPORTANT: This must be unique across all your products. See example below |

#### Example

For a t-shirt (sku TS001-red) there are 3 sizes:

- S: TS001S

- M: TS001M

- L: TS001L

To send data for size M you would set `parentSku = TS001-red` and `sku = TS001M`

# Purchase orders

## Getting purchase orders

```

```

curl "https://api.sello.io/v5/purchaseorders" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"meta": {
"total": 3
},
"orders": [
{
"created_at": "2018-08-29T12:10:00.000Z",
"supplier_id": 3468,
"customer_order_number": 3,
"state": "open",
"currency": "EUR",
"total": 98,
"supplier_name": "Shoe Supplier Inc",
"notes": null,
},
{
"created_at": "2018-08-29T12:01:10.000Z",
"supplier_id": 3468,
"customer_order_number": 2,
"state": "open",
"currency": "EUR",
"total": 41.4,
"supplier_name": "Shoe Supplier Inc",
"notes": null
}
]
}

```

This endpoint will retrieve your purchase orders.

### HTTP Request

`GET https://api.sello.io/v5/purchaseorders`

### Data

| Parameter | Read only | Description |
| id | yes | Internal purchase order id |
| number | yes | Merchant order id |
| created_at | yes | When the order was created |
| supplier_id | yes | The supplier id of this order |
| state | no | Valid values are: open, pending, received |
| supplier_name | yes | The supplier's name (based on the supplier_id) |
| total | yes | Order total |
| currency | yes | Based on the supplier's currency |
| notes | no | Merchant's notes on the order (max 255 chars) |

### Filtering

The following fields supports filtering:

- state

- id

To filter, add `filter[{filter name}]=value` to the url. You can add one or many filters at once. For example:

`GET https://api.sello.io/v5/purchaseorders?filter[state]=open`

### Searching

To search, add `search={query}` to the url. For example:

`GET https://api.sello.io/v5/purchaseorders?search=shoe`

## Add a purchase order

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"supplier_id":"3468"}' https://api.sello.io/v5/purchaseorders
```

The above command will respond with status `201` and return the created order:

```
{
    "id": 79,
    "created_at": "2018-08-29T13:20:32.000Z",
    "supplier_id": 3468,
    "number": 10,
    "state": "open",
    "currency": "EUR",
    "total": 0,
    "supplier_name": "Shoe Supplier Inc",
    "notes": null,
}
```

This endpoint will add an order.

### HTTP Request

`POST https://api.sello.io/v5/purchaseorders`

### Supported parameters

| Parameter | Required? |
| supplier_id | yes |

## Copy a purchase order

```

```

curl -H "Authorization: meowmeowmeow" -X POST https://api.sello.io/v5/purchaseorders/{id}/copy

```

The above command will respond with status `201` and return the created order:

```

{
"id": 79,
"created_at": "2018-08-29T13:20:32.000Z",
"supplier_id": 3468,
"number": 10,
"state": "open",
"currency": "EUR",
"total": 0,
"supplier_name": "Shoe Supplier Inc",
"notes": null,
}

```

This endpoint will copy an order.

### HTTP Request

`POST https://api.sello.io/v5/purchaseorders/{id}/copy`

## Change a purchase order

```

```
curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/purchaseorders/{id} -d '{"state":"pending"}'
```

The above command will respond with status `200` if successful

This endpoint will update a purchaseorder. Only send the attributes you wish to update, the other attributes will remain unchanged.
When an order has state "received", you are not allowed to change it to another state.

### HTTP Request

`PUT https://api.sello.io/v5/purchaseorders/{id}`

### Supported attributes

The following attributes may be updated, any other attributes will be silently ignored and unchanged.

- state

- notes

- supplier_id

## Delete a purchase order

```

```

curl -H "Authorization: meowmeowmeow" -X DELETE https://api.sello.io/v5/purchaseorders/{orderId}

```

The above command will respond with status `200` if successful

This endpoint will delete an order. You are not allowed to delete orders that have "received" state.

### HTTP Request

`DELETE https://api.sello.io/v5/purchaseorders/{orderId}`

## Getting purchase order rows

```

```
curl "https://api.sello.io/v5/purchaseorders/{id}/rows" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
[
    {
        "id": 13196,
        "product_id": 39407525,
        "quantity": 10,
        "price_each": 3.1,
        "name": "My test product 1",
        "sku": "TEST1"
    },
    {
        "id": 13197,
        "product_id": 38504479,
        "quantity": 5,
        "price_each": 0.14,
        "name": "My test product 2",
        "sku": "TEST2"
    }
]
```

This endpoint will retrieve an array of all order rows for specified order.

### HTTP Request

`GET https://api.sello.io/v5/purchaseorders/{id}/rows`

### Data

| Parameter | Description |
| id | Order row id (read only) |
| quantity | How many you want to purchase |
| product_id | Sello product id |
| price_each | Purchase price per each |
| name | Product's private name |
| sku | Product's private reference |

## Add an order row

```
 39407525, "quantity" => 10],
            [ "id" => 38504479, "quantity" => 5]
        ]
    ]
));
curl_setopt($handle, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'Content-Type: application/json',
    'Authorization: meowmeowmeow'
]);

$response = curl_exec($handle);
$code = curl_getinfo($handle, CURLINFO_HTTP_CODE);

echo "Code: $code, response: $response";
```

```
curl "https://api.sello.io/v5/purchaseorders/{id}/rows" -H "Authorization: meowmeowmeow" -X POST -d '{"products": [{ "id": 39407525, "quantity": 10}, {"id": 38504479, "quantity": 5}]}'
```

The above command returns all the rows in the order like this:

```
[
    {
        "id": 13196,
        "product_id": 39407525,
        "quantity": 10,
        "price_each": 0.14,
        "name": "My test product 1",
        "sku": "TEST1"
    },
    {
        "id": 13197,
        "product_id": 38504479,
        "quantity": 5,
        "price_each": 0.53,
        "name": "My test product 2",
        "sku": "TEST2"
    },
    {
        "id": 13198,
        "product_id": 39407525,
        "quantity": 10,
        "price_each": 4.32,
        "name": "My test product 3",
        "sku": "TEST3"
    }
]
```

This endpoint will add an rows to an existing order. The price for each row is fetched from product's purchase price field and converted from your account's currency to the order currency (specified by the supplier's currency).

Required fields are:

An array of objects with:

- product_id (the Sello product id)

- quantity (how many to purchase)

### HTTP Request

`POST https://api.sello.io/v5/purchaseorders/{id}/rows`

## Change purchase order rows

```

```

curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/purchaseorders/{id}/rows -d '[{"id": 13010, "quantity": 10},{"id": 13011, "quantity": 40}]'

```

The above command will respond with status `200` if successful

This endpoint will update the rows specified in your array. You must supply an id for each row you want to update. Only send the attributes you wish to update, the other attributes will remain unchanged.

### HTTP Request

`PUT https://api.sello.io/v5/purchaseorders/{id}/rows`

### Supported attributes

The following attributes may be updated, any other attributes will be silently ignored and unchanged.

- price_each

- quantity

## Delete a purchase order row

```

```
curl -H "Authorization: meowmeowmeow" -X DELETE https://api.sello.io/v5/purchaseorders/{orderId}/rows/{rowId}
```

The above command will respond with status `200` if successful

This endpoint will delete a row from your order. You are not allowed to delete rows from orders that have "received" state.

### HTTP Request

`DELETE https://api.sello.io/v5/purchaseorders/{orderId}/rows/{rowId}`

## Getting purchase order Excel file

```

```

curl "https://api.sello.io/v5/purchaseorders/{id}/xlsx" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"url": "https://s3-eu-west-1.amazonaws.com/sello-tmp/purchaseorder/834/ds2471j.xlsx"
}

```

This endpoint will return an object with an url attribute where you can get the generated file.

### HTTP Request

`GET https://api.sello.io/v5/purchaseorders/{id}/xlsx`

# Settings

## Getting settings

```

```
curl "https://api.sello.io/v5/settings/{keys}" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
{
  "shipping_tax": "12",
  "mail_send_copy": "0"
}
```

This endpoint will retrieve the supplied setting keys as an object. To fetch multiple settings, simply separate setting keys by comma (like `https://api.sello.io/v5/settings/shipping_tax,mail_send_copy`. If a key doesn't have a setting, it's default value will be returned.

### HTTP Request

`GET https://api.sello.io/v5/settings/shipping_tax,mail_send_copy`

## Update settings

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '{"shipping_tax":"25", "mail_send_copy": "1"}' https://api.sello.io/v5/settings

```

The above command will respond with status `200` and return the updated settings object:

```

{
"shipping_tax": "25",
"mail_send_copy": "1"
}

```

This endpoint will update settings provided in the object.

### HTTP Request

`PUT https://api.sello.io/v5/settings`

# Shipping

## Get Unifaun settings

```

```
curl "https://api.sello.io/v5/shipping/unifaun/{id}" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
{
  "sender": {
    "phone": "+46123456789",
    "name": "Sell-o AB",
    "address": "Kungsgatan 88",
    "zip": "80292",
    "city": "Gävle",
    "country": "SE",
    "email": "support@sello.io"
  },
  "accountType": "standard",
  "mediaSettings": {
    "target1Media": "thermo-se",
    "target1XOffset": 0,
    "target1YOffset": 0,
    "target2Media": "laser-ste",
    "target2XOffset": 0,
    "target2YOffset": 0,
    "target3Media": null,
    "target3XOffset": 0,
    "target3YOffset": 0,
    "target4Media": null,
    "target4XOffset": 0,
    "target4YOffset": 0
  }
}
```

This endpoint will retrieve settings for the specified Unifaun integration.

### HTTP Request

`GET https://api.sello.io/v5/shipping/unifaun/{id}`

## Update Unifaun settings

```

```

curl -H "Authorization: meowmeowmeow" -X PUT -d '{ "sender": { "phone": "+46123456789", "name": "Sell-o AB", "address": "Kungsgatan 88", "zip": "80292", "city": "Gävle", "country": "SE", "email": "support@sello.io" }, "accountType": "standard", "mediaSettings": { "target1Media": "thermo-se", "target1XOffset": 0, "target1YOffset": 0, "target2Media": "laser-ste", "target2XOffset": 0, "target2YOffset": 0, "target3Media": null, "target3XOffset": 0, "target3YOffset": 0, "target4Media": null, "target4XOffset": 0, "target4YOffset": 0 }}' https://api.sello.io/v5/shipping/unifaun/{id}

```

The above command will respond with status `204` and no output

This endpoint will update settings for a specified Unifaun integration. To edit, simply PUT back the data you GET.

### HTTP Request

`PUT https://api.sello.io/v5/shipping/unifaun/{id}`

## Get all Unifaun transporters

```

```
curl "https://api.sello.io/v5/shipping/unifaun/{id}/transporters" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
[
  {
    "customerId": "389372",
    "name": "Bring Express",
    "id": "BOX",
    "group": "bring",
    "logo": "https://images.sello.io/logistics/bring.svg"
  },
  {
    "customerId": null,
    "name": "Bring Citymail",
    "id": "BCMSE",
    "group": "bring",
    "logo": "https://images.sello.io/logistics/bring.svg"
  },
  {
    "customerId": "7382917464872",
    "name": "PostNord InNight",
    "id": "HIT",
    "group": "postnord",
    "logo": "https://images.sello.io/logistics/postnord.svg"
  },
  {
    "customerId": null,
    "name": "Fraktkompaniet",
    "id": "FRKO",
    "group": "fraktkompaniet",
    "logo": "https://images.sello.io/logistics/fraktkompaniet.svg"
  }
]
```

This endpoint will retrieve all available transporters for the specified Unifaun integration.

### HTTP Request

`GET https://api.sello.io/v5/shipping/unifaun/{id}/transporters`

## Get a specific Unifaun transporter

```

```

curl "https://api.sello.io/v5/shipping/unifaun/{id}/transporters/{transporterId}" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"customerId": "389372",
"name": "Bring Express",
"id": "BOX",
"group": "bring",
"logo": "https://images.sello.io/logistics/bring.svg"
}

```

This endpoint will retrieve a single transporter for the specified Unifaun integration.

### HTTP Request

`GET https://api.sello.io/v5/shipping/unifaun/{id}/transporters/{transporterId}`

## Update a Unifaun transporter

```

```
curl -H "Authorization: meowmeowmeow" -X PUT -d '{ "customerId": "123" }' https://api.sello.io/v5/shipping/unifaun/{id}/transporters/{transporterId}
```

The above command will respond with status `204` and no output

This endpoint will update customer id on a transporter.

### HTTP Request

`PUT https://api.sello.io/v5/shipping/unifaun/{id}/transporters/{transporterId}`

## Get services for a Unifaun transporter

```

```

curl "https://api.sello.io/v5/shipping/unifaun/{id}/transporters/{transporterId}/services" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

[
{
"id": "DPD",
"addons": [
{
"name": "Collection Request",
"id": "CRR"
},
{
"name": "Leveransavisering",
"id": "DLVNOT"
},
{
"name": "Varuförsäkring",
"id": "INSU"
}
],
"name": "PostNord DPD Utrikes",
"return": false
}
]

```

This endpoint will retrieve all services for a for the specified transporter.

### HTTP Request

`GET https://api.sello.io/v5/shipping/unifaun/{id}/transporters/{transporterId}/services`

## Sending orders to Unifaun (make shipping labels)

```

Payload example:

{
"orders": [
{
"id": "10718220",
"packages": 1,
"weight": "10",
"addons": [
{
"id": "NOTSMS",
"phone": "070123456789"
}
]
},
{
"id": "13844363",
"packages": 1,
"weight": "10",
"addons": [
{
"id": "ENOT",
"email": "support@sello.io"
}
]
}
],
"transport": {
"transporter": "PLAB",
"customerNo": "894672528",
"service": "P19",
"return": false
}
}

```

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{ "orders": [ { "id": "10718220", "packages": 1, "weight": "10", "addons": [ { "id": "NOTSMS", "phone": "070123456789" } ] }, { "id": "13844363", "packages": 1, "weight": "10", "addons": [ { "id": "ENOT", "email": "support@sello.io" } ] } ], "transport": { "transporter": "PLAB", "customerNo": "894672528", "service": "P19", "return": false } } ' https://api.sello.io/v5/shipping/unifaun/{id}/send
```

The above command will respond with status `201` and a link to the generated PDF shipping document, containing all shipping labels.

This endpoint will generate shipping labels for the supplied orders.

### HTTP Request

`POST https://api.sello.io/v5/shipping/unifaun/{id}/send`

## Getting history

```

```

curl -H "Authorization: meowmeowmeow" https://api.sello.io/v5/shipping/unifaun/{id}/history

```

The above command will respond with status `200` and an array of history:

```

[
{
"date": "2017-04-05T05:35:15+00:00",
"errors": [
{
"id": 10718220,
"number": 656,
"message": "Address_Zipcode: Not valid postal code (for more information click on \"!\")."
},
{
"id": 10718220,
"number": 656,
"message": "Party_Zipcode: Postal code doesnt exists ."
}
]
},
{
"date": "2017-04-04T13:57:17+00:00",
"file": "https://shipping-documents.s3.amazonaws.com/8346/2017-04-04/merged/20170404_1357.pdf"
},
{
"date": "2017-04-04T13:55:20+00:00",
"file": "https://shipping-documents.s3.amazonaws.com/8346/2017-04-04/merged/20170404_1355.pdf"
},
{
"date": "2017-04-04T13:53:55+00:00",
"file": "https://shipping-documents.s3.amazonaws.com/8346/2017-04-04/merged/20170404_1353.pdf"
},
{
"date": "2017-04-04T13:52:42+00:00",
"file": "https://shipping-documents.s3.amazonaws.com/8346/2017-04-04/merged/20170404_1352.pdf"
}
]

```

This endpoint will return history for the five past requests, including any generated files or error messages.

### HTTP Request

`GET https://api.sello.io/v5/shipping/unifaun/{id}/history`

## Sending orders to Pacsoft (make shipping labels)

```

Payload example:

{
"orders": [
{
"id": "10718220",
"packages": 1,
"notification": "letter"
},
{
"id": "13844363",
"packages": 1,
"notification": "sms"
}
],
"service": "PAE"
}

```

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{ "orders": [ { "id": "10718220", "packages": 1, "notification": "letter" }, { "id": "13844363", "packages": 1, "notification": "sms" }], "service": "PAE" }' https://api.sello.io/v5/shipping/pacsoft/{id}/send
```

The above command will respond with status `201` and stream the generated xml file.

This endpoint will generate an XML file for importing to Pacsoft Online.

Valid values for `notification` are: `sms`, `letter`, `email`.

### HTTP Request

`POST https://api.sello.io/v5/shipping/pacsoft/{id}/send`

## Sending orders to Multishipping (make shipping labels)

```
Payload example:

{
    "orders": [
        {
            "id": "10718220",
            "packages": 1,
            "notification": "letter",
            "type": "box"
        },
        {
            "id": "13844363",
            "packages": 1,
            "notification": "sms",
            "type": "box"
        }
    ],
    "template": "DHLMULTISHIPPING"
}
```

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '{"orders": [{"id": "10718220","packages": 1,"notification": "letter","type": "box"},{"id": "13844363","packages": 1,"notification": "sms","type": "box"}],"template": "DHLMULTISHIPPING"}' https://api.sello.io/v5/shipping/multishipping/{id}/send

```

The above command will respond with status `201` if successful

This endpoint will send deliveries to DHL Multishipping.

Valid values for `notification` are: `sms` or `email`.

### HTTP Request

`POST https://api.sello.io/v5/shipping/multishipping/{id}/send`

# Status

## Get all status

```

```
curl "https://api.sello.io/v5/status" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
[
  {
    "id": "2591259",
    "title": "Payment received",
    "color": "#bfdabf",
    "is_paid": true,
    "is_delivered": false,
    "is_active": true,
    "is_deleted": false
  },
  {
    "id": "2591257",
    "title": "Awaiting payment",
    "color": "#1a1ad4",
    "is_paid": false,
    "is_delivered": false,
    "is_active": true,
    "is_deleted": false
  }
]
```

This endpoint will retrieve all order status.

### HTTP Request

`GET https://api.sello.io/v5/status`

## Get a single status

```

```

curl "https://api.sello.io/v5/status/{id}" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

{
"id": "2591259",
"title": "Payment received",
"color": "#bfdabf",
"is_paid": true,
"is_delivered": false,
"is_active": true,
"is_deleted": false
}

```

This endpoint will retrieve a single status.

### HTTP Request

`GET https://api.sello.io/v5/status/{id}`

## Add a status

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{ "title": "Booked", "color": "#ffcc00", "is_paid": true, "is_delivered": false, "is_active": true, "is_deleted": false }' https://api.sello.io/v5/status
```

The above command will respond with status `201` and return the created status:

```
{
  "id": "2632065",
  "title": "Booked",
  "color": "#ffcc00",
  "is_paid": true,
  "is_delivered": false,
  "is_active": true,
  "is_deleted": false
}
```

This endpoint will add a status.

### HTTP Request

`POST https://api.sello.io/v5/status`

### Data

| Parameter | Required? | Description |
| title | yes | The status name (30 chars) |
| color | yes | RGB hex color code for this status, including # (i.e. #bfdabf) |
| is_paid | yes | Boolean if an order with this status is paid |
| is_delivered | yes | Boolean if an order with this status is delivered |
| is_active | yes | Boolean if an order with this status is active |
| is_deleted | yes | Boolean if an order with this status is deleted. If you set this to true, all other flags will be set to false |

## Change a status

```

```

curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/manufacturers/{id} -d '{"title":"New status title"}'

```

The above command will respond with status `200` if successful

This endpoint will update a status. Only send the attributes you wish to update, the other attributes will remain unchanged.

### HTTP Request

`PUT https://api.sello.io/v5/status/{id}`

## Remove a status

```

```
curl -H "Authorization: meowmeowmeow" -X DELETE https://api.sello.io/v5/status/{id}
```

The above command will respond with status `204` if successful

This endpoint will remove a status.

### HTTP Request

`DELETE https://api.sello.io/v5/status/{id}`

### Data

| Parameter | Required? | Description |
| id | yes | The status id to remove |

# Suppliers

## Getting suppliers

```

```

curl "https://api.sello.io/v5/suppliers" -H "Authorization: meowmeowmeow"

```

The above command returns a JSON array structured like this:

```

[
{
"id": 3468,
"name": "My Supplier Inc",
"address": "5th ave street",
"postalcode": "AB1345",
"city": "Cooltown",
"countrycode": "DE",
"email": "foo@bar.com",
"phone": "07010101010",
"currency": "EUR"
}
]

```

This endpoint will retrieve all your suppliers.

### HTTP Request

`GET https://api.sello.io/v5/suppliers`

### Data

| Parameter | Read only | Description |
| id | yes | Internal supplier id |
| name | no | Supplier name |
| currency | no | Supplier currency |
| address | no | Supplier address |
| postalcode | no | Supplier postalcode |
| city | no | Supplier city |
| countrycode | no | Supplier countrycode |
| email | no | Supplier email |
| phone | no | Supplier phone |

### Getting a single supplier

`GET https://api.sello.io/v5/suppliers/{id}`

This will return your supplier data

## Add a supplier

```

```
curl -H "Authorization: meowmeowmeow" -X POST -d '{"name": "My new supplier", "currency": "EUR"}' https://api.sello.io/v5/suppliers
```

The above command will respond with status `201` and return the created supplier:

```
{
    "id": 3469,
    "name": "My new supplier",
    "currency": "EUR",
    "address": null,
    "postalcode": null,
    "city": null,
    "countrycode": null,
    "email": null,
    "phone": null
}
```

This endpoint will create a new supplier.

### HTTP Request

`POST https://api.sello.io/v5/suppliers`

### Supported parameters

| Parameter | Required? |
| name | yes |
| currency | yes |
| name | no |
| address | no |
| postalcode | no |
| countrycode | no |
| email | no |
| phone | no |

## Delete a supplier

```

```

curl -H "Authorization: meowmeowmeow" -X DELETE https://api.sello.io/v5/suppliers/{id}'

```

The above command will respond with status `200` if successful

This endpoint will delete a supplier. If there are products assigned to this supplier, this call will fail with an error.

### HTTP Request

`DELETE https://api.sello.io/v5/suppliers/{id}`

## Change a supplier

```

```
curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/suppliers/{id} -d '{"name":"New supplier name"}'
```

The above command will respond with status `200` if successful

This endpoint will update a supplier. Only send the attributes you wish to update, the other attributes will remain unchanged.

### HTTP Request

`PUT https://api.sello.io/v5/suppliers/{id}`

# Tax

## Get all tax classes

```

```

curl "https://api.sello.io/v5/tax" -H "Authorization: meowmeowmeow"

```

The above command returns JSON structured like this:

```

[
{
"id": "RFH0vZF",
"name": "Standard tax",
"rules": {
"4": {
"SE": "25.00"
}
}
}
]

```

This endpoint will retrieve all tax classes.

### HTTP Request

`GET https://api.sello.io/v5/tax`

## Get a single tax class

```

```
curl "https://api.sello.io/v5/tax/{id}" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
{
  "id": "RFH0vZF",
  "name": "Standard tax",
  "rules": {
    "4": {
      "SE": "25.00"
    }
  }
}
```

### HTTP Request

`GET https://api.sello.io/v5/tax/{id}`

## Add a tax class

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '{"name":"Standard tax", "rules": {"4": {"SE": "25.00"}}}' https://api.sello.io/v5/tax

```

The above command will respond with status `201` and return the created tax class:

```

{
"id": "RFH0vZF",
"name": "Standard tax",
"rules": {
"4": {
"SE": "25.00"
},
"5": {
"SE": "25.00",
"NO": "20.1",
"FI": "12.9"
}
}
}

```

This endpoint will add a tax class.

### HTTP Request

`POST https://api.sello.io/v5/tax`

### Data

| Parameter | Required? | Description |
| name | yes | The class name, for internal reference - will not be exposed externally |
| rules | yes | An object of integration id, country and the tax rate: `{ "integration": {"country": "rate"}}` |

## Change a tax class

```

```
curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/tax/{id} -d '{"name":"Standard tax 2", "rules": {"4": {"SE": "25.00"}}}'
```

The above command will respond with status `200` if successful

This endpoint will update a tax class.

### HTTP Request

`PUT https://api.sello.io/v5/tax/{id}`

## Remove a tax class

```

```

curl -H "Authorization: meowmeowmeow" -X DELETE https://api.sello.io/v5/tax/{id}

```

The above command will respond with status `204` if successful

This endpoint will remove a tax class. If a class is in use by a product, you will return a `409 Conflict` error.

### HTTP Request

`DELETE https://api.sello.io/v5/tax/{id}`

# Webhooks

Webhooks allow you to collect information about events as they happen in near real-time. Provide a URL and what event you want to receive data about, and we’ll send it to you as the events take place.

You may specify multiple url's for the same hooks. For example, `orderNew` can be delivered to two url's if you wish.

Webhooks allow you to collect information about events as they happen in near real-time. Provide a URL and what event you want to receive data about, and we’ll send it to you as the events take place.

To test our Webhooks before setting up scripts, the RequestBin tool is an excellent utility that helps you see data come across as various events happen in our system.

## Configuring webhooks

Webhooks are configured from your Sello account. Here are the basic steps:

- Log in to your Sello account

- Navigate to Settings

- Click Developers -> WebHooks

Configuration is simple: Enter a valid url for us to contact, then select the event and you want to have sent to you.

## Securing webhooks

We currently support either HTTP or HTTPS urls, so you can have security by using an SSL-enabled url. But keep in mind that your endpoint is going to be wide-open on the internet, and you might not want others to be able to submit random data to your systems. At this time, aside from trying to keep the URL private, our best suggestion is to simply include a secret key in the URL your provide and check that parameter in your scripts.

## Supported events

Our Webhooks implementation currently support the following events:

- New order (also triggered if an order is updated)

- Paid order

- Updated order

- Product update

- Product quantity update

## Event data

When an event occurs that you have turned on, we’ll send a HTTP POST request to the URL you’ve specified. If that URL is unavailable, returns a 500-ish status code or takes too long to respond (more than 15 seconds), we’ll cancel the request and try again later. Retries happen over the course of one hour and 15 minutes. This may be tweaked as we receive feedback from users.

The webhook that Sello send will only contain the ID of the order or the ID of the product that is triggering the webhook. You will then need to fetch the actual data from Sello API v5 with that product ID or order ID.

## Get all webhooks

```

```
curl "https://api.sello.io/v5/developers/webhooks" -H "Authorization: meowmeowmeow"
```

The above command returns JSON structured like this:

```
[
  {
    "url": "http://requestb.in/1am97l1",
    "hook": "productUpdated"
  },
  {
    "url": "http://requestb.in/1am97l1",
    "hook": "orderNew"
  },
  {
    "url": "http://requestb.in/yqg5mtq",
    "hook": "orderNew"
  },
  {
    "url": "http://requestb.in/1am97l1",
    "hook": "productUpdated"
  }
]
```

This endpoint will retrieve all webhooks that have been set up on your account.

### HTTP Request

`GET https://api.sello.io/v5/developers/webhooks`

## Add a webhook

```

```

curl -H "Authorization: meowmeowmeow" -X POST -d '{ "hook": "orderNew", "url": "http://requestb.in/1e6yy7j1" }' https://api.sello.io/v5/developers/webhooks

```

The above command will respond with status `201` and return all webhooks:

```

[
{
"url": "http://requestb.in/1am97l1",
"hook": "productUpdated"
},
{
"url": "http://requestb.in/1am97l1",
"hook": "orderNew"
},
{
"url": "http://requestb.in/yqg5mtq",
"hook": "orderNew"
},
{
"url": "http://requestb.in/1am97l1",
"hook": "productUpdated"
},
{
"url": "http://requestb.in/1e6yy7j1",
"hook": "orderNew"
}
]

```

This endpoint will add a webhook.

### HTTP Request

`POST https://api.sello.io/v5/developers/webhooks`

### Data

| Parameter | Required? | Description |
| hook | yes | The type of webhook. Supported values are: `orderNew`, `orderPaid`, `orderUpdated`, `productUpdated`, `productQuantityUpdated` |
| url | yes | The URL where the hooks should be dispatched. When you add the hook, Sello will attempt to POST to the url. The resulting status should be in the 200-ish range. |

## Change webhooks

```

```
curl -H "Authorization: meowmeowmeow" -X PUT https://api.sello.io/v5/developers/webhooks -d '[{"url": "http://requestb.in/1am97li1","hook": "productUpdated"  },  {"url": "http://requestb.in/1am97li1","hook": "orderNew"  },  {"url": "http://requestb.in/yqg5mtyqaa","hook": "orderNew"  },  {"url": "http://requestb.in/1am97li1","hook": "productUpdated"  },  {"url": "http://requestb.in/1e6yy7j1","hook": "orderNew"  }]'
```

The above command will respond with status `200` if successful

This endpoint will update your webhooks. The url is validated an tested (we'll issue a POST request)

### HTTP Request

`PUT https://api.sello.io/v5/developers/webhooks`

### Data

Send the full data you're getting from `GET` on this resource.

## Remove a webhook

Simply `PUT` the data with the hook removed from the data.

                [php](#)
                [shell](#)
