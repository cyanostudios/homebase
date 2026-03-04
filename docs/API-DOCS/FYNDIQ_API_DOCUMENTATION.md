##OBSERVERA. Följande information kan ha formateringsfel, stavfel, kodfel. Betrakta som guidelines att gå efter men rätta eventuella fel enligt best practice. Fråga om tveksamheter uppstår och ytterligare förklaring behövs.

**NEW FYNDIQ API**

Fyndiq enables merchants to upload products and manage orders on the Fyndiq platform. For the customer we provide a marketplace for easy access to a wide variety of products for those small moments of joy.

This documentation will guide merchants through the development of their technical integration. Request and response samples can be found on the right hand side of the documentation page, with drop down menus for different scenarios.

**API overview**

We choose to design our API around the REST ideology, providing simple and predictable URLs to access and modify objects:

**Server - client interaction**

We identify two different roles: the client that initiates the interaction and the server that replies. The server will never initiate any interaction, its role is simply to process the request it receives and to return an appropriate response.  
In our case, the merchant will be the client and Fyndiq will be the server.

**Resource**

Fyndiq API exposes resources; a resource is an addressable object that can be reached via an URL.  
In our first iteration the only objects you can interact with are the **ARTICLE** and the **ORDER**.  
We are constantly working on improving our API by adding new endpoints for existing resources and making new resources available.

**HTTP requests and methods**

Resources may be accessed via HTTP requests and you can act on the resources according to different methods or verbs:
| METHOD | ACTION |
|--------|--------|
| POST | Create |
| GET | Read |
| PUT | Update |
| DELETE | Delete |

**HTTP status codes**

HTTP status code is used to indicate success or failure of an API call. The body of the response contains the details of the error.
| Code | ACTION |
|------|--------------|
| 2xx | Success |
| 4xx | Client Error |
| 5xx | Server Error |

**FYNDIQ API**

**Authentication**

All of our API endpoints requires Basic Authentication. Your requests must include an HTTP Authorization header containing "Basic" followed by the Base64-encoded string _"merchantID:token"_ :

**Plain Text**

Basic {base64_encode(merchantID:token)}

**URL prefix**

The Fyndiq API offers a set of endpoints that can be reached via the following root URL:

Live API URL:

**Plain Text**

<https://merchants-api.fyndiq.se/api/v1/>

**Request**

All request arguments must be passed in JSON message format with the Content-Type set as application/json.

Merchants using the Fyndiq API should ensure that their API-calling systems support TLS 1.1 or higher. TLS 1.0 is not an available protocol on our servers. We strongly recommend TLS 1.2.

**Response**

Unless otherwise specified, all of Fyndiq API responses will return the information that you request in the JSON data format.

**ARTICLES**

**POST Create an article**

<https://merchants-api.fyndiq.se/api/v1/articles>

**Definition**

This endpoint will allow you to create an article.

A request can be sent for one single article.

**Request body parameters**

Parameters that are not available **MUST** be removed from the body of the request.
| Parameter | Description | Data type | Required |
|------------------------|-------------------------------------------------------------------------|----------------------------------------------|----------|
| sku | Your unique ID for the article | String (1-64) | Yes |
| parent_sku | Group-identifier for the product, same as the sku for the main article | String (1-64) | No |
| legacy_product_id | Legacy Product ID from the former platform | Non-negative Integer (0-100 000 000) | No |
| status | Sale status for the article | String ("for sale" or "paused") | Yes |
| quantity | Quantity, in stock, of the article | Non-negative Integer (0-500 000) | Yes |
| categories | Categories of the article | See categories related data format | Yes |
| properties* | Properties of the article | See properties related data format | No |
| variational_properties | List of property names used for choosing variations in an article group | See properties related data format | No |
| brand | Manufacturer of the article | String (1-50) | No |
| gtin | Unique global identifier | String (1-13) | No |
| main_image | Direct link to the main image of the article | String (1-1500), valid URL | Yes |
| images | Direct links to the extra images of the article | List of strings (1-1500), valid URLs, 10 max | No |
| markets* | Countries where your article will be on sale | See market related data format | Yes |
| title* | Name of the article | See language related field data format | Yes |
| description* | Detailed text describing the article (no html) | See language related field data format | Yes |
| price* | Price of the article | See price related data format | Yes |
| shipping_time* | Time for the package to reach the customer | See shipping related data format | Yes |
| delivery_type* | How the package will be delivered to the customer | See delivery related data format | No |
| kn_number | Kombinerade nomenklaturen number | String (1-48) | No |
\*\* Specific fields. Data to be entered as an array of hashmaps. See below.*

**Categories**

categories

The category tree can be fetched using our API, please check section **List categories** for more information.
| Key/value | Type |
|------------|----------------------------|
| categories | List of categories (max 5) |

**Plain Text**

"categories": \["1", "2"\]

**Properties**

Properties are sent in as Key/value pairs. The keys are defined by FYNDIQ and for some keys we also define possible values.

The properties are divided into three groups, free text, numerical and pre-defined values.

**Free text properties**

The values for these properties are supplied as strings. We require the language to be supplied for these values, currently "sv-SE" and "en-US" is supported.

**Pre-defined value properties**

The values for these properties are chosen from a pre-defined list controlled by Fyndiq.

**Numerical properties**

The values for these properties are sent as integers or decimal numbers in a string.

The list of properties in JSON format can be found here:  
<https://merchantcenter.fyndiq.se/properties.json>

Deprecated link to the same file:  
<http://developers.fyndiq.com/assets/properties.json>
| Key/value | Type | Required |
|-----------|---------------|-------------------------------|
| name | String | Yes |
| value | String (1-36) | Yes |
| language | String (5) | Only for free text properties |

**Plain Text**

"properties":

\[

{

"name": "color", //Free text

"value": "Deep Green",

"language": "en-US"

},

{

"name": "fyndiq-size_SML", //Pre-defined

"value": "xxl"

},

{

"name": "shoe_size_eu", //Numerical

"value": "40"

}

\]

Variational properties are used to specify which properties makes a variation unique within an article group. The combination of the values of the variational properties needs to be unique for each article within the article group.
| Key/value | Type |
|------------------------|-----------------------|
| variational_properties | List of strings (1-2) |
**Plain Text**

"variational_properties": \["color", "size"\]

**Market**

markets

Specifies which **MARKETS** (countries) where the product should be available for sale. **Currently SE (Sweden), DK (Denmark), FI (Finland) and NO (Norway) is supported.** Enter the country codes, as per [ISO-3166 standard](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
| Key/value | Type |
|-----------|-----------------|
| markets | List of strings |

**Plain Text**

markets: \["SE", "DK"\]

**Shipping**

shipping_time

Use this field to indicate the expected time period for the package to reach the customer (range, in days). This will vary according to the **MARKET** and is to be sent as an array of hashmaps.
| Key/value | Type |
|-----------|-------------|
| market | String (2) |
| min | Integer 1-9 |
| max | Integer 1-9 |

**Plain Text**

shipping_time: \[

{

"market": "SE",

"min": 2,

"max": 5

},

{

"market": "DK",

"min": 4,

"max": 9

}\]

**Prices**

price

The data will vary according to the **MARKET** and is to be sent as an array of hashmaps.  
For each price, the currency must be given, as per [ISO-4217 standard](https://en.wikipedia.org/wiki/ISO_4217).  
Prices are to be supplied including VAT.
| Key/value | Type | Required |
|-----------------------|---------------|----------|
| market | String (2) | Yes |
| amount_including_vat\* | Decimal (1-7) | Yes |
| currency | String (3) | Yes |
| vat_rate | Decimal** | No** |

- Key can be sent as "amount", but note that when fetching articles and orders amount is used to represent the amount excluding VAT.

\*\* If no vat_rate is supplied the default value for the market will be applied

**Plain Text**

"price": \[

{

"market": "SE",

"value": {

"amount": 79,

"currency": "SEK"

}

},

{

"market": "DK",

"value": {

"amount": 99,

"currency": "DKK"

}

}\]

**Language**

We support language localisation for the article fields:

title

description

You can provide us with the data in different languages for a better searchability and customer experience. **Swedish** is currently **required** for articles to be put on sale **unless the merchant is part of our translation program**.

We choose to represent languages with a combination of a language designator, as per [ISO-639 standard](https://en.wikipedia.org/wiki/ISO_639-1), and a region designator, as per [ISO-3166 standard](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).

For example, to specify the English language as it is used in the United States, enter **en-US**.

The data is to be sent as an array of hashmaps.
| Key/value | Type |
|---------------------|------------------|
| language | String (5) |
| value (title) | String (5-150) |
| value (description) | String (10-4096) |

**Plain Text**

"title": \[

{

"language": "sv-SE",

"value": "This is the title in Swedish"

},

{

"language": "en-US",

"value": "This is the title in English"

}\]

description is constructed the same way.

**Delivery**

delivery_type

Delivery type is used to specify how the package will be sent to the customer.  
Currently the types of deliveries that can be specified are:  
mailbox and service_point

Only one entry per market is allowed.
| Key/value | Type | Required |
|-----------|------------|----------|
| market | String (2) | Yes |
| value | String | Yes |

**Plain Text**

"delivery_type":

\[

{"market": "SE", "value": "mailbox"},

{"market": "DK", "value": "service_point"}

\]

**Response**

In the response we will return the Fyndiq article ID, our unique identifier for the article. The article ID is required for all parameter updates you will send via API call.

**Plain Text**

{

"id": "{{article_id}}",

"description": "Article was created."

}

**Example Request: 201 - Created**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/articles>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--data '{

"sku":"123",

"legacy_product_id":123151,

"categories": \["1", "2"\],

"status":"for sale",

"quantity":67,

"main_image":"<http://test.test/test.png>",

"images": \["<http://test.test/test2.png>", "<http://test.test/test3.png>", "<http://test.test/test4.png"\>],

"markets": \["SE"\],

"title":\[{"language": "en-US", "value": "T-shirt"}\],

"description":\[{"language": "en-US", "value": "This is a red t-shirt, ideal for summer"}\],

"price":\[{"market": "SE", "value": {"amount": 4.99, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 10, "currency": "SEK"}}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 20}\]

}'

**Example Response: 201 CREATED**

**Body:**

**json**

{

"id": "{{article_id}}",

"description": "Article was created."

}

**Headers:**
| | |
|----------------|---------------------------------------------------------|
| Connection | keep-alive |
| | Options that are desired for the connection |
| Content-Length | 57 |
| | The length of the response body in octets (8-bit bytes) |
| Content-Type | application/json |
| | The mime type of this content |
| Date | Thu, 21 Dec 2017 09:59:02 GMT |
| | The date and time that the message was sent |
| Server | nginx |
| | A name for the server |

**Example Request: 409 - SKU already exists**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/articles>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data '{

"sku":"123",

"legacy_product_id":123151,

"categories": \["1", "2"\],

"status":"for sale",

"quantity":67,

"main_image":"<http://test.test/test.png>",

"images": \["<http://test.test/test2.png>", "<http://test.test/test3.png>", "<http://test.test/test4.png"\>],

"markets": \["SE"\],

"title":\[{"language": "en-US", "value": "T-shirt"}\],

"description":\[{"language": "en-US", "value": "This is a red t-shirt, ideal for summer"}\],

"price":\[{"market": "SE", "value": {"amount": 4.99, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 10, "currency": "SEK"}}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 20}\]

}'

**Example Response: 409 CONFLICT**

**Body:**

**json**

{

"description": "SKU already exists, can not create article!",

"errors": {

"response_status_code": 200

}

}
**Headers:**
No response headers
This request doesn't return any response headers

**Example Request: 400 - Invalid Payload**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/articles>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--data '{

"sku":"123",

"parent_sku":"123",

"status":"for sale",

"quantity":499,

"categories":\["1"\],

"brand":"brand",

"gtin":"121212121212",

"main_image":"<http://test.test/test.png>",

"images": \["<http://test.test/test2.png>", "<http://test.test/test3.png>", "<http://test.test/test4.png"\>],

"markets": \["SE"\],

"title":\[{"language": "sv-SE", "value": "Article title. The article creation will fail now since the title is being tooooooooooooooooooooooo loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooong, more than 200 characters long."}\],

"description":\[{"language": "sv-SE", "value": "Article description, with no HTML."}\],

"price":\[{"market": "SE", "value": {"amount": 50, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 100, "currency": "SEK"}}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 3}\]

}'

**Example Response: 400 BAD REQUEST**

**Body:**

**json**

{

"description": "Invalid payload",

"errors": {

"title": \[

{

"0": \[

{

"value": \[

"max length is 64"

\]

}

\]

}

\]

}

}

**Headers:**
| | |
|----------------|---------------------------------------------------------|
| Connection | keep-alive |
| | Options that are desired for the connection |
| Content-Length | 57 |
| | The length of the response body in octets (8-bit bytes) |
| Content-Type | application/json |
| | The mime type of this content |
| Date | Thu, 21 Dec 2017 09:59:02 GMT |
| | The date and time that the message was sent |
| Server | nginx |
| | A name for the server |

**Example Request: 401 - Incorrect Credentials**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/articles>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data '{

"sku":"123",

"parent_sku":"123",

"status":"for sale",

"quantity":499,

"categories":\["1"\],

"brand":"brand",

"gtin":"121212121212",

"main_image":"<http://test.test/test.png>",

"images": \["<http://test.test/test2.png>", "<http://test.test/test3.png>", "<http://test.test/test4.png"\>],

"markets": \["SE"\],

"title":\[{"language": "sv-SE", "value": "Article title"}\],

"description":\[{"language": "sv-SE", "value": "Article description, with no HTML."}\],

"price":\[{"market": "SE", "value": {"amount": 50, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 100, "currency": "SEK"}}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 3}\]

}'

**Example Response: 401 UNAUTHORIZED**

**Body:**

**json**

{

"description": "Authorization credentials were incorrect"

}

**Headers:**
| | |
|----------------|---------------------------------------------------------|
| Connection | keep-alive |
| | Options that are desired for the connection |
| Content-Length | 57 |
| | The length of the response body in octets (8-bit bytes) |
| Content-Type | application/json |
| | The mime type of this content |
| Date | Thu, 21 Dec 2017 09:59:02 GMT |
| | The date and time that the message was sent |
| Server | nginx |
| | A name for the server |

**POST Bulk Create**

<https://merchants-api.fyndiq.se/api/v1/articles/bulk>

**Definition**

This endpoint will allow you to create a batch of articles through one single call.

Our api accepts up to 100 create requests per call.

**Request Body**

The request body for bulk updates are constructed by putting instances of the same structure used in Create Article in a list:

**Plain Text**

\[

{

CREATE ARTICLE BODY 1

},

{

CREATE ARTICLE BODY 2

},

...

\]

**Response**

We first make sure that the bulk is valid (valid json object). In case it is valid, we return a 202 - Accepted. And we will list the specific responses for each single create request included in the bulk. These responses follow the same order as the create request order of your bulk. So the first response relates to the first update request of your bulk.

In this example, the bulk was accepted however only the first create request of the bulk was sucessful:

**Plain Text**

{

"description": "Accepted",

"responses": \[

{

"id": "61c0ffd0-ec59-4ec1-bd3a-a7c2d894e4eb",

"description": "Article was created"

},

{

"description": "Can not create article",

"errors": {

"properties": \[

{

"0": \[

{

"language": \[

"unallowed value de-US"

\]

}

\]

}

\]

},

"status_code": 400

}

\]

}

**Example Request: 202 - Entire bulk successful**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/articles>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--data '{

"sku":"123",

"parent_sku":"123",

"status":"for sale",

"quantity":499,

"categories":\["1"\],

"brand":"brand",

"gtin":"121212121212",

"main_image":"<http://test.test/test.png>",

"images": \["<http://test.test/test2.png>", "<http://test.test/test3.png>", "<http://test.test/test4.png"\>],

"markets": \["SE"\],

"title":\[{"language": "sv-SE", "value": "Article title. The article creation will fail now since the title is being tooooooooooooooooooooooo loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooong, more than 200 characters long."}\],

"description":\[{"language": "sv-SE", "value": "Article description, with no HTML."}\],

"price":\[{"market": "SE", "value": {"amount": 50, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 100, "currency": "SEK"}}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 3}\]

}'

**Example Response: 202 ACCEPTED**

**Body:**

**json**

{

{

"description": "Accepted",

"responses": \[

{

"id": "61c0ffd0-ec59-4ec1-bd3a-a7c2d894e4eb",

"description": "Article was created"

},

{

"id": "12c0ffd0-wc54-4ec1-b32d-a7c2d8923a23",

"description": "Article was created"

}

\]
}

}

**GET Retrieve an article**

<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}>

**Definition**

This endpoint will allow you to retrieve an article

**Request query parameter**
| Key/value | Type | Required |
|-----------|------------|----------|
| market | String (2) | Yes |
| value | String | Yes |

**Response**

The full article object will be returned.

**Plain Text**

{

"id": "cdf52cd6-4f6d-4bb3-9a47-53dc0f7977a3",

"legacy_product_id": 123351,

"product_id": "cc3502412af2949e3c10c60ef67ee14d",

"categories": \[

"1",

"2"

\],

"sku": "my_sku",

"parent_sku": "",

"title": \[

{

"language": "en-US",

"value": "T-shirt"

}

\],

"description": \[

{

"language": "en-US",

"value": "This is a red t-shirt, ideal for summer"

}

\],

"quantity": 67,

"status": "for sale",

"fyndiq_status": "new",

"fyndiq_reasons": \[\],

"properties": \[

{

"name": "color",

"value": "green"

},

{

"name": "size",

"value": "M"

}

\],

"variational_properties": \[

"color"

\],

"brand": "",

"gtin": "",

"main_image": "<http://my.domain/test.png>",

"images": \[

"<http://my.domain/test2.png>",

"<http://my.domain/test3.png>",

"<http://my.domain/test4.png>"

\],

"markets": \[

"SE"

\],

"merchant_id": "188eb3fb-e483-4787-825a-df31ab6dedd5",

"price": \[

{

"market": "SE",

"value": {

"amount": "49.00",

"currency": "SEK"

}

}

\],

"original_price": \[

{

"market": "SE",

"value": {

"amount": "10.00",

"currency": "SEK"

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 1,

"max": 5

}

\]

}

**HEADERS**

**Authorization**

Basic {ODliNjdkYTktZjM1ZS00NTYwLThjYzYtMGIyMmVhOTAyYTY3OmI3MjgzZTZiLTJhOWEtNDAzMC1iMjg1LTViMzVkZDBiNGY5OA==}

**Example Request: 403 - Non-existing article**

**curl**

curl --location -g '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json'

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "You do not have permission to access this object"

}

**Example Request: 200 - OK**

**curl**

curl --location -g '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}'

**Example Response: 200 OK**

**Body:**

**json**

{

"id": "{{article_id}}",

"product_id": "{{product_id}}",

"sku": "123",

"parent_sku": "123",

"title": \[

{

"language": "en-US",

"value": "Article title in English"

}

\],

"description": \[

{

"language": "en-US",

"value": "Article description in English, with no HTML"

}

\],

"quantity": 499,

"status": "for sale",

"fyndiq_status": "new",

"fyndiq_reasons": \[\],

"categories": \[

"category 1",

"category 2"

\],

"properties": \[

{

"name": "color",

"value": "Red"

},

{

"name": "size",

"value": "XL"

}

\],

"brand": "brand",

"gtin": "121212121212",

"main_image": "<http://test.test/test.png>",

"images": \[

"<http://test.test/test2.png>",

"<http://test.test/test3.png>",

"<http://test.test/test4.png>"

\],

"markets": \[

"SE"

\],

"merchant_id": "{{yourmerchant_id}}",

"price": \[

{

"market": "SE",

"value": {

"amount": "50.00",

"currency": "SEK"

}

}

\],

"original_price": \[

{

"market": "SE",

"value": {

"amount": "10.00",

"currency": "SEK"

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 2,

"max": 5

}

\]

}

**Headers**
| | |
|----------------|-------------------------------|
| Connection | keep-alive |
| Content-Length | 57 |
| Content-Type | application/json |
| Date | Thu, 21 Dec 2017 09:59:02 GMT |
| Server | nginx |

**GET Retrieve an article by SKU**

<https://merchants-api.fyndiq.se/api/v1/articles/sku/{{SKU}}>

**Definition**

This endpoint will allow you to retrieve an article by SKU.

**Request query parameter**
| Parameter | Description | Required |
|-----------|---------------------------------------------------------|----------|
| SKU | SKU for the article, given on the article creation call | Yes |

**Response**

**The full article object will be returned.**

**Plain Text**

{

"description": "Article found",

"content": {

"article": {

"id": "cdf52cd6-4f6d-4bb3-9a47-53dc0f7977a3",

"legacy_product_id": 123351,

"product_id": "cc3502412af2949e3c10c60ef67ee14d",

"categories": \[

"1",

"2"

\],

"sku": "my_sku",

"parent_sku": "",

"title": \[

{

"language": "en-US",

"value": "T-shirt"

}

\],

"description": \[

{

"language": "en-US",

"value": "This is a red t-shirt, ideal for summer"

}

\],

"quantity": 67,

"status": "for sale",

"fyndiq_status": "new",

"fyndiq_reasons": \[\],

"properties": \[

{

"name": "color",

"value": "green"

},

{

"name": "size",

"value": "M"

}

\],

"variational_properties": \[

"color"

\],

"brand": "",

"gtin": "",

"main_image": "<http://my.domain/test.png>",

"images": \[

"<http://my.domain/test2.png>",

"<http://my.domain/test3.png>",

"<http://my.domain/test4.png>"

\],

"markets": \[

"SE"

\],

"merchant_id": "188eb3fb-e483-4787-825a-df31ab6dedd5",

"price": \[

{

"market": "SE",

"value": {

"amount": "80.00",

"currency": "SEK",

"vat_amount": "20.00",

"vat_rate": "0.25"

}

}

\],

"original_price": \[

{

"market": "SE",

"value": {

"amount": "159.20",

"currency": "SEK",

"vat_amount": "39.80",

"vat_rate": "0.25"

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 1,

"max": 5

}

\]

}

}

}

**Example Request: 404 - Not found**

**curl**

curl --location -g '<https://merchants-api.fyndiq.se/api/v1/articles/sku/{{sku}}>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json'

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "Not found",

"errors": {

"description": "Article not found",

"content": {}

}

}

**Example Request: 200 - OK**

**curl**

curl --location -g '<https://merchants-api.fyndiq.se/api/v1/articles/sku/{{sku}}>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}'

**Example Response: 200 OK**

**Body:**

**json**

{

"description": "Article found",

"content": {

"article": {

"id": "{{article_id}}",

"product_id": "{{product_id}}",

"sku": "123",

"parent_sku": "123",

"title": \[

{

"language": "en-US",

"value": "Article title in English"

}

\],

"description": \[

{

"language": "en-US",

"value": "Article description in English, with no HTML"

}

\],

"quantity": 499,

"status": "for sale",

"fyndiq_status": "new",

"fyndiq_reasons": \[\],

"categories": \[

"category 1",

"category 2"

\],

"properties": \[

{

"name": "color",

"value": "Red"

},

{

"name": "size",

"value": "XL"

}

\],

"brand": "brand",

"gtin": "121212121212",

"main_image": "<http://test.test/test.png>",

"images": \[

"<http://test.test/test2.png>",

"<http://test.test/test3.png>",

"<http://test.test/test4.png>"

\],

"markets": \[

"SE"

\],

"merchant_id": "{{yourmerchant_id}}",

"price": \[

{

"market": "SE",

"value": {

"amount": "80.00",

"currency": "SEK",

"vat_amount": "20.00",

"vat_rate": "0.25"

}

}

\],

"original_price": \[

{

"market": "SE",

"value": {

"amount": "159.20",

"currency": "SEK",

"vat_amount": "39.80",

"vat_rate": "0.25"

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 2,

"max": 5

}

\]

}

}

}

**Headers**
| | |
|----------------|-------------------------------|
| Connection | keep-alive |
| Content-Length | 57 |
| Content-Type | application/json |
| Date | Thu, 21 Dec 2017 09:59:02 GMT |
| Server | nginx |

**GET List articles**

<https://merchants-api.fyndiq.se/api/v1/articles>

**Definition**

This endpoint will allow you to retrieve the product data you have on your Fyndiq account.

**Query parameters**

We paginate the response; you can retrieve up to 1000 articles per page. A request run with no parameters will return 100 articles on page 1 (default settings). Listing articles with for_sale=true will only return articles where state = "for sale".
| Parameter | Default value | Required |
|-----------|---------------|----------|
| limit | 100 | No |
| page | 1 | No |
| for_sale | false | No |

**Response**

Article objests will be returned, as per the settings of your request. See response samples on the right hand-side column.

**Example Request: List articles (default settings)**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/articles>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}'

**Example Response: 200 OK**

**Body:**

**json**

\[

{

"id": "{{article_id}}",

"product_id": "{{product_id}}",

"sku": "123",

"parent_sku": "123",

"title": \[

{

"language": "en-US",

"value": "Article title in English"

}

\],

"description": \[

{

"language": "en-US",

"value": "Article description in English, with no HTML"

}

\],

"quantity": 499,

"status": "for sale",

"fyndiq_status": "new",

"fyndiq_reasons": \[\],

"categories": \[

"category 1",

"category 2"

\],

"properties": \[

{

"name": "color",

"value": "Red"

},

{

"name": "size",

"value": "XL"

}

\],

"brand": "brand",

"gtin": "121212121212",

"main_image": "<http://test.test/test.png>",

"images": \[

"<http://test.test/test2.png>",

"<http://test.test/test3.png>",

"<http://test.test/test4.png>"

\],

"markets": \[

"SE"

\],

"merchant_id": "{{yourmerchant_id}}",

"price": \[

{

"market": "SE",

"value": {

"amount": "49.00",

"currency": "SEK"

}

}

\],

"original_price": \[

{

"market": "SE",

"value": {

"amount": "100.00",

"currency": "SEK"

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 2,

"max": 5

}

\]

},

{

"id": "{{article_id}}",

"product_id": "{{product_id}}",

"sku": "124",

"parent_sku": "123",

"title": \[

{

"language": "en-US",

"value": "Article title in English"

}

\],

"description": \[

{

"language": "en-US",

"value": "Article description in English, with no HTML"

}

\],

"quantity": 499,

"status": "for sale",

"fyndiq_status": "new",

"fyndiq_reasons": \[\],

"categories": \[

"category 2",

"category 3"

\],

"properties": \[

{

"name": "color",

"value": "Red"

},

{

"name": "size",

"value": "XL"

}

\],

"brand": "brand",

"gtin": "121212121212",

"main_image": "<http://test.test/test.png>",

"images": \[

"<http://test.test/test2.png>",

"<http://test.test/test3.png>",

"<http://test.test/test4.png>"

\],

"markets": \[

"SE"

\],

"merchant_id": "{{yourmerchant_id}}",

"price": \[

{

"market": "SE",

"value": {

"amount": "29.00",

"currency": "SEK"

}

}

\],

"original_price": \[

{

"market": "SE",

"value": {

"amount": "60.00",

"currency": "SEK"

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 2,

"max": 5

}

\]

}

\]

**Example Request: List articles (up to 1000)**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/articles?limit=1000&page=1>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}'

**Example Response: 200 OK**

**Body:**

**json**

\[

{

"id": "{{article_id}}",

"product_id": "{{product_id}}",

"sku": "123",

"parent_sku": "123",

"title": \[

{

"language": "en-US",

"value": "Article title in English"

}

\],

"description": \[

{

"language": "en-US",

"value": "Article description in English, with no HTML"

}

\],

"quantity": 499,

"status": "for sale",

"fyndiq_status": "new",

"fyndiq_reasons": \[\],

"categories": \[

"category 1",

"category 2"

\],

"properties": \[

{

"name": "color",

"value": "Red"

},

{

"name": "size",

"value": "XL"

}

\],

"brand": "brand",

"gtin": "121212121212",

"main_image": "<http://test.test/test.png>",

"images": \[

"<http://test.test/test2.png>",

"<http://test.test/test3.png>",

"<http://test.test/test4.png>"

\],

"markets": \[

"SE"

\],

"merchant_id": "{{yourmerchant_id}}",

"price": \[

{

"market": "SE",

"value": {

"amount": "49.00",

"currency": "SEK"

}

}

\],

"original_price": \[

{

"market": "SE",

"value": {

"amount": "100.00",

"currency": "SEK"

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 2,

"max": 5

}

\]

},

{

"id": "{{article_id}}",

"product_id": "{{product_id}}",

"sku": "124",

"parent_sku": "123",

"title": \[

{

"language": "en-US",

"value": "Article title in English"

}

\],

"description": \[

{

"language": "en-US",

"value": "Article description in English, with no HTML"

}

\],

"quantity": 499,

"status": "for sale",

"fyndiq_status": "new",

"fyndiq_reasons": \[\],

"categories": \[

"category 2",

"category 3"

\],

"properties": \[

{

"name": "color",

"value": "Red"

},

{

"name": "size",

"value": "XL"

}

\],

"brand": "brand",

"gtin": "121212121212",

"main_image": "<http://test.test/test.png>",

"images": \[

"<http://test.test/test2.png>",

"<http://test.test/test3.png>",

"<http://test.test/test4.png>"

\],

"markets": \[

"SE"

\],

"merchant_id": "{{yourmerchant_id}}",

"price": \[

{

"market": "SE",

"value": {

"amount": "29.00",

"currency": "SEK"

}

}

\],

"original_price": \[

{

"market": "SE",

"value": {

"amount": "60.00",

"currency": "SEK"

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 2,

"max": 5

}

\]

}

\]

**GET List Categories**

<https://merchants-api.fyndiq.se/api/v1/categories/{{MARKET}}/{{LANGUAGE}}/>

**Definition**

This endpoint will allow you to retrieve the category tree for Fyndiq articles.

**URL Structure**

When fetching the category tree you will need to supply market and language for the tree you want to fetch.

[**https://merchants-api.fyndiq.se/api/v1/categories/SE/en-US/**](https://merchants-api.sandbox.fyndiq.se/api/v1/categories/SE/en-US/) will fetch the tree for the Swedish market in English, changing en-US to sv-SE will fetch the same tree but with Swedish names.

**Response**

The category tree will be returned as a list where each node has the following attributes:
| Attribute | Description |
|----------------------|-------------------------------------------------------------------------------------|
| id | The ID of the category. |
| name | Name of the category. |
| path | The path from the ancestor root category to the current category separated by dots. |
| search_friendly_name | Search friendly name, if available. |

**Plain Text**

\[

{

"id": 1,

"name": "Fashion",

"path": "1",

"search_friendly_name": ""

},

{

"id": 423,

"name": "Accessories",

"path": "1.423",

"search_friendly_name": ""

},

...

\]

**Example Request: List categories**

**curl**

curl --location -g '<https://merchants-api.fyndiq.se/api/v1/categories/{{MARKET}}/{{LANGUAGE}}/>'

**Example Response**

**Body:**

**json**

**No response body**

This request doesn't return any response body

**PUT Update an article**

<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}>

**Definition**

This endpoint will allow you to update articles

We give the merchant the possibility to update their article data. Each request can contain one or several parameter updates for one specific article.

**Request query parameter**
| Parameter | Description | Required |
|------------|-----------------------------------------------------|----------|
| article_id | Fyndiq unique ID for the article you want to update | Yes |

**Request body parameters**

We do not support partial updates.  
All parameters that are editable, must be present, even the ones that are not being updated.
| Parameter | Description | Data type | Required |
|------------------------|-------------------------------------------------------------------------|----------------------------------------------|----------|
| sku | Your unique ID for the article | String (1-64) | Yes |
| parent_sku | Group-identifier for the product, same as the sku for the main article | String (0-64) | No |
| legacy_product_id | Legacy Product ID from the former platform | Non-negative Integer (0-100 000 000) | No |
| status | Sale status for the article | String ("for sale" or "paused") | Yes |
| categories | Categories of the article | See categories related data format | Yes |
| properties* | Properties of the article | See properties related data format | No |
| variational_properties | List of property names used for choosing variations in an article group | See properties related data format | No |
| brand | Manufacturer of the article | String (0-50) | No |
| gtin | Unique global identifier | String (0-13) | No |
| main_image | Direct link to the main image of the article | String (0-1500), valid URL | Yes |
| images | Direct links to the extra images of the article | List of strings (0-1500), valid URLs, 10 max | No |
| markets* | Countries where your article will be on sale | See market related data format | Yes |
| title* | Name of the article | See language related field data format | Yes |
| description* | Detailed text describing the article (no html) | See language related field data format | Yes |
| shipping_time\* | Time for the package to reach the customer | See shipping related data format | Yes |

\* Specific fields. Data to be entered as an array of hashmaps. See section on how to _Create an article._

**NOTE**: Price and stock cannot be updated via this endpoint. There are specific calls for these two parameters.  
See section on how to _Update an article price_ and _Update an article quantity_.

**Response**

In case of success, we return a simple 204, with no body:

**Plain Text**

{}

**Example Request: 403 - Permission denied**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}>' \\

\--header 'Authorization;' \\

\--header 'Content-Type: application/json' \\

\--data '{

"sku":"123",

"parent_sku":"123",

"status":"for sale",

"tags":\["Main tag", "Tag 2", "Tag 3", "Tag 4"\],

"size":"XL",

"color":"Red",

"brand":"brand",

"gtin":"121212121212",

"main_image":"<http://test.test/test.png>",

"images": \["<http://test.test/test2.png>", "<http://test.test/test3.png>", "<http://test.test/test4.png"\>],

"markets": \["SE"\],

"title":\[{"language": "en-US", "value": "Article title in English"}\],

"description":\[{"language": "en-US", "value": "Article description, with no HTML"}\],

"shipping_time":\[{"market": "SE", "value": "15 - 20"}\]

}'

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "Permission denied",

"errors": {

"response_status_code": 403

}

}

**Example Request: 204 - Successful update**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--data '{

"sku":"123",

"parent_sku":"123",

"status":"for sale",

"categories":\["1", "2"\],

"brand":"brand",

"gtin":"121212121212",

"main_image":"<http://test.test/test.png>",

"images": \["<http://test.test/test2.png>", "<http://test.test/test3.png>", "<http://test.test/test4.png"\>],

"markets": \["SE"\],

"title":\[{"language": "en-US", "value": "Article title in English"}\],

"description":\[{"language": "en-US", "value": "Article description, with no HTML"}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 3}\]

}'

**Example Response: 204 NO CONTENT**

**Body:**

**json**

{}

**Example Request: 400 - Invalid payload**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--data '{

"sku":"123",

"parent_sku":"123",

"status":"in-stock",

"categories":\["1", "2"\],

"brand":"brand",

"gtin":"121212121212",

"main_image":"<http://test.test/test.png>",

"images": \["<http://test.test/test2.png>", "<http://test.test/test3.png>", "<http://test.test/test4.png"\>],

"markets": \["SE"\],

"title":\[{"language": "en-US", "value": "Article title in English"}\],

"description":\[{"language": "en-US", "value": "Article description, with no HTML"}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 3}\]

}'

**Example Response: 400 BAD REQUEST**

**Body:**

**json**

{

"description": "Invalid payload",

"errors": {

"status": \[

"unallowed value in-stock"

\]

}

}

**PUT Update an article price**

<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}/price>

**Definition**

This endpoint will allow you to update the price of an article

**Request query parameter**
| Parameter | Description | Required |
|------------|-----------------------------------------------------|----------|
| article_id | Fyndiq unique ID for the article you want to update | Yes |

**Request body parameters**
| Parameter | Description | Data type | Required |
|-----------------|---------------------------------------------|-------------------------------|----------|
| price* | Price of the article | See price related data format | Yes |
| original_price* | Price of the article, before sell on Fyndiq | See price related data format | Yes |

\*Specific fields. Data to be entered as an array of hashmaps. See _Create an article_.

**Response**

In case of sucess, we return a simple 204, with no body:

**Plain Text**

{}

**Example Request: 400 - Invalid payload**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}/price>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data '{

"price":\[{"market": "SE", "value": {"amount": "60", "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": "100", "currency": "SEK"}}\],

}'

**Example Response: 400 BAD REQUEST**

**Body:**

**json**

{

"description": "Invalid payload",

"errors": {

"price": \[

{

"0": \[

{

"value": \[

{

"amount": \[

"must be of float type"

\]

}

\]

}

\]

}

\]

}

}

**Example Request: 403 - Permission denied**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}/price>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data '{

"price":\[{"market": "SE", "value": {"amount": 60, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 100, "currency": "SEK"}}\],

}'

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "Permission denied",

"errors": {

"response_status_code": 403

}

}

**Example Request: 204 - Successful update**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}/price>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data '{

"price":\[{"market": "SE", "value": {"amount": 60, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 100, "currency": "SEK"}}\],

}'

**Example Response: 204 NO CONTENT**

**Body:**

**json**

{}

**PUT Update an article quantity**

<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}/quantity>

**Definition**

This endpoint will allow you to update the quantity of an article

**Request query parameter**
| Parameter | Description | Required |
|------------|-----------------------------------------------------|----------|
| article_id | Fyndiq unique ID for the article you want to update | Yes |

**Request body parameter**
| Parameter | Description | Data type | Required |
|-----------|------------------------------------|----------------------------------|----------|
| quantity | Quantity, in stock, of the article | Non-negative Integer (0-500 000) | Yes |

**Response**

In case of sucess, we return a simple 204, with no body:

**Plain Text**

{}

**Example Request: 403 - Permission denied**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}/quantity>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data '{

"quantity": 299

}'

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "Permission denied",

"errors": {

"response_status_code": 403

}

}

**Example Request: 400 - Invalid payload**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}/quantity>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data '{

"quantity": "299"

}'

**Example Response: 400 BAD REQUEST**

**Body:**

**json**

{

"description": "Invalid payload",

"errors": {

"quantity": \[

"must be of integer type"

\]

}

}

**Example Request: 204 - Successful update**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}/quantity>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data '{

"quantity": 299

}'

**Example Response: 204 NO CONTENT**

**Body:**

**json**

{}

**PUT Bulk Update**

<https://merchants-api.fyndiq.se/api/v1/articles/bulk>

**Definition**

This endpoint will allow you to update a batch of articles through one single call.

Our api accepts up to 200 update requests per call. There are 4 different update request types, called actions.

You can send different actions in the same call. You can also send different actions for the same article in the same call, as long as you do not sent the same action for the same article twice.

**Request body parameters**

All parameters that are editable, must be included in the request, even the ones that are not being updated. Remember, parameters that are not required and are not available for the article can be set to empty string but MUST be present in the body of the request.
| Parameter | Description | Data type | Required |
|-----------|-----------------------------------------------------|------------|----------|
| action | The type of update request | String | Yes |
| id | Fyndiq unique ID for the article you want to update | String | Yes |
| body | The updated data | Dictionary | Yes |

The body will differ according to the action:

**update_article**

Same body schema as the single article update.

**update_article_price**

Same body schema as the single article price update.

**update_article_quantity**

Same body schema as the single article quantity update.

**delete_article**

Empty dictionary.

**Response**

We first make sure that the bulk is valid (valid json object). In case it is valid, we return a 202 - Accepted. And we will list the specific responses for each single update request included in the bulk. These responses follow the same order as the update request order of your bulk. So the first response relates to the first update request of your bulk.

**In this example, the bulk was accepted however only the last update request of the bulk was sucessful: { "description": "Accepted", "responses": \[ { "description": "Invalid payload", "errors": { "sku": \[ "required field" \] }, "status_code": 400 }, { "description": "No permission to edit article", "status_code": 403 }, { "description": "Invalid payload", "errors": { "quantity": \[ "must be of integer type" \] }, "status_code": 400 }, { "description": "Accepted", "status_code": 202 } \] }**

In case the bulk is not valid, we return a 400 - Bad request and we indicate which update request is faulty. In the following case, the bulk was not accepted due to the body of the third update request being missing.

**Plain Text**

{

"description": "Invalid payload",

"errors": {

"bulk_payload": \[

{

"3": \[

{

"body": \[

"required field"

\]

}

}\]}}

**Example Request: 202 - Valid bulk but invalid payload in specific actions**

**curl**

curl --location --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/bulk>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--data '\[

{

"action": "update_article",

"id": "77a9b3fb-cbea-47ce-a275-0327e05a5c83",

"body": {

"sku":"123",

"categories": \["1", "2"\],

"status":"for sale",

"properties": \[

{

"name": "fyndiq-color", "value": "red"

},

{

"name": "color", "value": "röd", "language": "sv-SE"

},

{

"name": "shoe_size_eu", "value": "30"

}

\],

"main_image":"<http://test.test/test123.png>",

"images": \[\],

"markets": \["SE"\],

"title":\[{"language": "sv-SE", "value": "Swedish title"},{"language": "en-US", "value": "English title"}\],

"description":\[{"language": "sv-SE", "value": "Swedish description"},{"language": "en-US", "value": "English description"}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 9}\]

}

},

{

"action": "update_article_price",

"id": "88a9b3fb-a275-cbea-47ce-0327e05adc83",

"body": {

"price":\[{"market": "SE", "value": {"amount": 60, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 100, "currency": "SEK"}}\]

}

},

{

"action": "update_article_quantity",

"id": "77a9b3fb-cbea-47ce-a275-0327e05adc83",

"body": {

"quantity": "25"

}

},

{

"action": "delete_article",

"id": "77a9b3fb-cbea-47ce-a275-0327e05adc83",

"body": {}

}

\]'

**Example Response: 202 ACCEPTED**

**Body:**

**json**

{

"description": "Accepted",

"responses": \[

{

"description": "Action accepted",

"status_code": 202

},

{

"description": "Action accepted",

"status_code": 202

},

{

"description": "Invalid payload",

"errors": {

"quantity": \[

"must be of integer type"

\]

},

"status_code": 400

},

{

"description": "Action accepted",

"status_code": 202

}

\]

}

**Example Request: 202 - Entire bulk successful**

**curl**

curl --location --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/bulk>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--data '\[

{

"action": "update_article",

"id": "77a9b3fb-cbea-47ce-a275-0327e05a5c83",

"body": {

"sku":"123",

"categories": \["1", "2"\],

"status":"for sale",

"properties": \[

{

"name": "fyndiq-color", "value": "red"

},

{

"name": "color", "value": "röd", "language": "sv-SE"

},

{

"name": "shoe_size_eu", "value": "30"

}

\],

"main_image":"<http://test.test/test123.png>",

"images": \[\],

"markets": \["SE"\],

"title":\[{"language": "sv-SE", "value": "Swedish title"},{"language": "en-US", "value": "English title"}\],

"description":\[{"language": "sv-SE", "value": "Swedish description"},{"language": "en-US", "value": "English description"}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 9}\]

}

},

{

"action": "update_article_price",

"id": "88a9b3fb-a275-cbea-47ce-0327e05adc83",

"body": {

"price":\[{"market": "SE", "value": {"amount": 60, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 100, "currency": "SEK"}}\],

}

},

{

"action": "update_article_quantity",

"id": "77a9b3fb-cbea-47ce-a275-0327e05adc83",

"body": {

"quantity": 25

}

},

{

"action": "delete_article",

"id": "77a9b3fb-cbea-47ce-a275-0327e05adc83",

"body": {}

}

\]'

**Example Response: 202 ACCEPTED**

**Body:**

**json**

{

"description": "Accepted",

"responses": \[

{

"description": "Accepted",

"status_code": 202

},

{

"description": "No permission to edit article",

"status_code": 403

},

{

"description": "Accepted",

"status_code": 202

},

{

"description": "Accepted",

"status_code": 202

}

\]

}

**Example Request: 400 - Invalid payload**

**curl**

curl --location --request PUT '<https://merchants-api.fyndiq.se/api/v1/articles/bulk>' \\

\--header 'Content-Type: application/json' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--data '\[

{

"action": "update_article",

"id": "77a9b3fb-cbea-47ce-a275-0327e05a5c83",

"body": {

"sku":"123",

"categories": \["1", "2"\],

"status":"for sale",

"properties": \[

{

"name": "fyndiq-color", "value": "red"

},

{

"name": "color", "value": "röd", "language": "sv-SE"

},

{

"name": "shoe_size_eu", "value": "30"

}

\],

"main_image":"<http://test.test/test123.png>",

"images": \[\],

"markets": \["SE"\],

"title":\[{"language": "sv-SE", "value": "Swedish title"},{"language": "en-US", "value": "English title"}\],

"description":\[{"language": "sv-SE", "value": "Swedish description"},{"language": "en-US", "value": "English description"}\],

"shipping_time":\[{"market": "SE", "min": 1, "max": 9}\]

}

},

{

"action": "update_article_price",

"id": "88a9b3fb-a275-cbea-47ce-0327e05adc83",

"body": {

"price":\[{"market": "SE", "value": {"amount": 60, "currency": "SEK"}}\],

"original_price":\[{"market": "SE", "value": {"amount": 100, "currency": "SEK"}}\],

}

},

{

"action": "update_article_quantity",

"id": "77a9b3fb-cbea-47ce-a275-0327e05adc83",

"body": {

"quantity": 25

}

},

{

"action": "delete_article",

"id": "77a9b3fb-cbea-47ce-a275-0327e05adc83"

}

\]'

**Example Response: 400 BAD REQUEST**

**Body:**

**json**

{

"description": "Invalid payload",

"errors": {

"bulk_payload": \[

{

"3": \[

{

"body": \[

"required field"

\]

}

\]

}

\]

}

}

**DELETE Delete an article**

<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}>

**Definition**

This endpoint will allow you to delete an article

By running this call, you will set the field status to **deleted**. The article will no longer be visible to customers.

All deleted articles are still being visible to you through the API.

**Request query parameter**
| Parameter | Description | Required |
|------------|-----------------------------------------------------|----------|
| article_id | Fyndiq unique ID for the article you want to update | Yes |

**Response**

In case of sucess, we return a simple 204, with no body:

**Plain Text**

{}

**Example Request: 204 - Successful deletion**

**curl**

curl --location -g --request DELETE '<https://merchants-api.fyndiq.se/api/v1/articles/{{article_id}}>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response: 204 NO CONTENT**

**Body:**

**json**

{}

**ORDERS**

**Order attributes**

As soon as a customer completes an order of one of your articles, we will make the order information available via the resource **ORDERS**. It will include the necessary information regarding both the item that was sold and the customer who made the purchase.

Each order will contain only one SKU, with possible quantity (>1).
| Parameter | Description |
|------------------|------------------------------------------------------------|
| id | Fyndiq unique ID for the order (read only) |
| article_id | Fyndiq unique ID for the ordered article (read only) |
| article_title | Name of the ordered article (read only) |
| article_sku | Your unique ID for the ordered article (read only) |
| market | Market the order was made on (read only) |
| article_price | Price of the ordered item (excluding shipping) (read only) |
| article_vat_rate | VAT rate for the ordered article (read only) |
| quantity | Number of article units ordered (read only) |
| total_price | Full amount of the order (read only) |
| shipping_address | Customer information (read only) |
| created_at | Date the order was created on, UTC (read only) |
| fulfill_before | Date the order must be fulfilled by, UTC (read only) |
| state | Order state |

**Quantity / Price**

In case of an order with several quantity, the price do not represent the unit price but the price for all quantities.

article_price = unit price\*quantity

total_price = article_price

**NOTE:** All transactions are handled in the customer's local currency.

**Shipping Address**
| Parameter | Description |
|----------------|----------------------------------------------------|
| full_name | Customer full name |
| first_name | Customer first name (not available in a B2B order) |
| last_name | Customer last name (not available in a B2B order) |
| street_address | Customer street address |
| postal_code | Customer postal code |
| city | Customer city |
| country | Customer country |
| phone_number | Customer phone number |

**State**

In return, you are to inform us on the actions you are taking for the order. In most cases you will ship the package and therefore fulfill the order. In some cases you might need to cancel the order.
| State | Description |
|---------------|------------------------------------------------------|
| CREATED | New order, to be handled |
| FULFILLED | Order has been handled, item has been shipped |
| NOT_FULFILLED | Order has been cancelled, customer has been refunded |

The following calls will give you the ability to handle a single order as per above flow. \*Please note that once an order has entered the state\*\* **fulfilled** or **not_fulfilled**, the order state can no longer be modifiable.

**GET Retrieve an order**

<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}>

**Definition**

This endpoint will allow you to retrieve an order.

**Request query parameters**
| Parameter | Description | Required |
|-----------|--------------------------------|----------|
| order_id | Fyndiq unique ID for the order | Yes |

**Response**

The full order object will be returned.

**Plain Text**

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"title": "Article title",

"article_sku": "123",

"price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"total_price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"quantity": 2,

"shipping_address": {

"first_name": "Test",

"last_name": "Person",

"street_address": "Test address 1",

"city": "Test city",

"postal_code": "234567",

"country": "Test country",

"phone_number": "+46 00 000 00 00"

},

"market": "SE",

"state": "CREATED",

"created_at": "2018-01-01 16:57:06",

"updated_at": "2018-01-01 16:57:06",

"fulfillment_deadline": "2018-01-06 16:57:06",

"tracking_information": \[\]

}

**NOTE:** All transactions are handled in the customer's local currency.

**Example Request: 200 - Successful call**

**curl**

curl --location -g '<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json'

**Example Response: 200 OK**

**Body:**

**json**

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"title": "Article title",

"article_sku": "123",

"price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"total_price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"quantity": 2,

"shipping_address": {

"first_name": "Test",

"last_name": "Person",

"street_address": "Test address 1",

"city": "Test city",

"postal_code": "234567",

"country": "Test country",

"phone_number": "+46 00 000 00 00"

},

"market": "SE",

"state": "CREATED",

"created_at": "2018-01-01 16:57:06",

"updated_at": "2018-01-01 16:57:06",

"fulfillment_deadline": "2018-01-06 16:57:06",

"tracking_information": \[\]

}

**Headers**
| | |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| Connection | keep-alive |
| | Options that are desired for the connection |
| Content-Encoding | gzip |
| | The type of encoding used on the data. |
| Content-Type | text/html |
| | The mime type of this content |
| Date | Wed, 10 Jan 2018 15:00:54 GMT |
| | The date and time that the message was sent |
| Server | nginx |
| | A name for the server |
| Transfer-Encoding | chunked |
| | The form of encoding used to safely transfer the entity to the user. Currently defined methods are: chunked, compress, deflate, gzip, identity. |
| X-Request-ID | 221377f8b27e363e8e5968e90894404d |
| | Custom header |

**GET List orders**

<https://merchants-api.fyndiq.se/api/v1/orders/>

**Definition**

This endpoint will allow you to retrieve your order data.

**Query parameters**

**Filtering**

The field state supports filtering. **By default, we return new orders (orders in state CREATED)**.
| Filter values | Definition |
|---------------|--------------------|
| CREATED | New order |
| FULFILLED | Handled/shipped |
| NOT_FULFILLED | Cancelled/refunded |

**Pagination**

We return 100 orders by default and you can retrieve up to 1000 orders per page by using pagination parameters.
| Parameter | Default value | Required |
|-----------|---------------|----------|
| limit | 100 | No |
| page | 1 | No |

**You may combine pagination and filtering.**

**Response**

Order objects will be returned, as per the settings of your request. See response samples on the right hand-side column.

**Example Request: List cancelled orders**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/orders?state=NOT_FULFILLED>'

**Example Response: 200 OK**

**Body:**

**json**

\[

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"title": "Article title",

"article_sku": "123",

"price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"total_price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"quantity": 2,

"shipping_address": {

"first_name": "Test",

"last_name": "Person",

"street_address": "Test address 1",

"city": "Test city",

"postal_code": "234567",

"country": "Test country",

"phone_number": "+46 00 000 00 00"

},

"market": "SE",

"state": "NOT FULFILLED",

"created_at": "2018-01-01 16:57:06",

"updated_at": "2018-01-01 16:57:06",

"fulfillment_deadline": "2018-01-06 16:57:06",

"tracking_information": \[\]

},

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"title": "Article title",

"article_sku": "123",

"price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"total_price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"quantity": 2,

"shipping_address": {

"first_name": "Test2",

"last_name": "Person2",

"street_address": "Test address 2",

"city": "Test city",

"postal_code": "234567",

"country": "Test country",

"phone_number": "+46 00 000 00 00"

},

"market": "SE",

"state": "NOT_FULFILLED",

"created_at": "2018-01-01 16:57:06",

"updated_at": "2018-01-01 16:57:06",

"fulfillment_deadline": "2018-01-06 16:57:06",

"tracking_information": \[\]

}

\]

**Example Request: List new orders**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/orders?state=CREATED>'

**Example Response: 200 OK**

**Body:**

**Json**

\[

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"title": "Article title",

"article_sku": "123",

"price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"total_price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"quantity": 2,

"shipping_address": {

"first_name": "Test",

"last_name": "Person",

"street_address": "Test address 1",

"city": "Test city",

"postal_code": "234567",

"country": "Test country",

"phone_number": "+46 00 000 00 00"

},

"market": "SE",

"state": "CREATED",

"created_at": "2018-01-01 16:57:06",

"updated_at": "2018-01-01 16:57:06",

"fulfillment_deadline": "2018-01-06 16:57:06",

"tracking_information": \[\]

}

\]

**Example Request: List fulfilled orders**

**curl**

curl --location '<https://merchants-api.fyndiq.se/api/v1/orders?state=FULFILLED>'

**Example Response: 200 OK**

**Body:**

**json**

\[

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"title": "Article title",

"article_sku": "123",

"price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"total_price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"quantity": 2,

"shipping_address": {

"first_name": "Test",

"last_name": "Person",

"street_address": "Test address 1",

"city": "Test city",

"postal_code": "234567",

"country": "Test country",

"phone_number": "+46 00 000 00 00"

},

"market": "SE",

"state": "FULFILLED",

"created_at": "2018-01-01 16:57:06",

"updated_at": "2018-01-01 16:57:06",

"fulfillment_deadline": "2018-01-06 16:57:06",

"tracking_information": \[\]

},

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"title": "Article title",

"article_sku": "123",

"price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"total_price": {

"amount": 23.2,

"vat_amount": 5.8,

"vat_rate": 0.25,

"currency": "SEK"

},

"quantity": 2,

"shipping_address": {

"first_name": "Test2",

"last_name": "Person2",

"street_address": "Test address 2",

"city": "Test city",

"postal_code": "234567",

"country": "Test country",

"phone_number": "+46 00 000 00 00"

},

"market": "SE",

"state": "FULFILLED",

"created_at": "2018-01-01 16:57:06",

"updated_at": "2018-01-01 16:57:06",

"fulfillment_deadline": "2018-01-06 16:57:06",

"tracking_information": \[\]

}

\]

**PUT Fulfill an order**

<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}/fulfill>

**Definition**

This endpoint will allow you to fulfill an order.

A request can be sent for one single order.

Mark the order as handled as soon as you have shipped the item.  
By running this call, you will set the order field state to **fulfilled**.

Any order that has already been cancelled cannot be fulfilled.

**Request query parameter**
| Parameter | Description | Required |
|-----------|----------------------------------------------------|----------|
| order_id | Fyndiq unique ID for the order you want to fulfill | Yes |

**Adding tracking information**

If available the tracking information should be supplied in the body.

**Example body with tracking information**

**Plain Text**

{

"tracking_information": \[

{

"carrier_name": "Postnord",

"tracking_number": "abc123"

}

}

**Response**

**Plain Text**

{

"description": "Order row was fulfilled"

}

**HEADERS**

**Content-Type**

application/json

**Body** raw (json)

**json**

{

"tracking_information": \[

{

"carrier_name": "Postnord",

"tracking_number": "abc123"

}

\]

}

**Example Request: 202 - Successful fulfillment**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}/fulfill>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response: 202 ACCEPTED**

**Body:**

**json**

{

"description": "Order row was fulfilled"

}

**Headers**
| | |
|----------------|---------------------------------------------------------|
| Connection | keep-alive |
| | Options that are desired for the connection |
| Content-Length | 166 |
| | The length of the response body in octets (8-bit bytes) |
| Content-Type | text/html |
| | The mime type of this content |
| Date | Mon, 08 Jan 2018 13:43:35 GMT |
| | The date and time that the message was sent |
| Server | nginx |
| | A name for the server |
| X-Request-ID | c6e2d4c1fe2ef4c9ef631977b9974421 |
| | Custom header |

**Example Request: 403 - Order is already fulfilled**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}/fulfill>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "Order row already has fulfilled as state"

}

**Example Request: 403 - Order is already cancelled**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}/fulfill>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "Order row already has not_fulfilled as state"

}

**Example Request: 403 - Order has passed fulfillment date**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}/fulfill>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "Order has passed fulfillment due date"

}

**PUT Cancel an order**

<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}/cancel>

**Definition**

This endpoint will allow you to cancel an order.

This call should be used whenever you are unable to ship the item (for stock issue for example). It will set the order field state to **not_fulfilled**.

Any order that has already been fulfilled cannot be cancelled.

**Request query parameter**
| Parameter | Description | Required |
|-----------|---------------------------------------------------|----------|
| order_id | Fyndiq unique ID for the order you want to cancel | Yes |

**Response**

**Plain Text**

{

"description": "Order row was cancelled"

}

**Example Request: 202 - Successful cancellation**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}/cancel>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response: 202 ACCEPTED**

**Body:**

**json**

{

"description": "Order row was cancelled"

}

**Headers**
| | |
|----------------|---------------------------------------------------------|
| Connection | keep-alive |
| | Options that are desired for the connection |
| Content-Length | 166 |
| | The length of the response body in octets (8-bit bytes) |
| Content-Type | text/html |
| | The mime type of this content |
| Date | Mon, 08 Jan 2018 13:44:33 GMT |
| | The date and time that the message was sent |
| Server | nginx |
| | A name for the server |
| X-Request-ID | 962ebde8e5656009157430db29927b61 |
| | Custom header |

**Example Request: 403 - Order is already fulfilled**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}/cancel>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "Order row already has fulfilled as state"

}

**Example Request: 403 - Order is already cancelled**

**curl**

curl --location -g --request PUT '<https://merchants-api.fyndiq.se/api/v1/orders/{{order_id}}/cancel>' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response: 403 FORBIDDEN**

**Body:**

**json**

{

"description": "Order row already has not_fulfilled as state"

}
