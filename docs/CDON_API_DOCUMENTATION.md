##OBSERVERA. Följande information kan ha formateringsfel, stavfel, kodfel. Betrakta som guidelines att gå efter men rätta eventuella fel enligt best practice. Fråga om tveksamheter uppstår och ytterligare förklaring behövs.

**CDON API Documentation**

CDON enables merchants to upload products and manage orders on the CDON marketplace platform. For customers, we provide a marketplace offering easy access to a wide variety of products.

This documentation guides merchants through developing their technical integration. Request and response samples are available in the right-hand sidebar, with dropdown menus for different scenarios.

**API Overview**

Our API follows REST principles, providing simple and predictable URLs to access and modify resources.

**Server-Client Interaction**

The API follows a simple request-response model:

- **Client (Merchant)**: Initiates all interactions
- **Server (CDON)**: Processes requests and returns appropriate responses

**Resources**

The API exposes addressable resources via URLs. Currently available resources:

- **ARTICLE**
- **ORDER**

We continuously improve our API by adding new endpoints and resources.

**HTTP Methods**

Available actions for interacting with resources:
| Method | Action | Description                   |
|--------|--------|-------------------------------|
| POST   | Create | Create a new resource         |
| GET    | Read   | Retrieve resource information |
| PUT    | Update | Modify an existing resource   |
| DELETE | Delete | Remove a resource             |

**HTTP Status Codes**

Status codes indicate the success or failure of API calls:
| Code Range | Category     | Description                       |
|------------|--------------|-----------------------------------|
| 2xx        | Success      | Request processed successfully    |
| 4xx        | Client Error | Invalid request or authentication |
| 5xx        | Server Error | Internal server issues            |

**Authentication**

All API endpoints require Basic Authentication. Include an HTTP Authorization header with "Basic" followed by the Base64-encoded string merchantID:token:

**Plain Text**

Basic {base64_encode(merchantID:token)}

**API Environments**

**Production Environment**

Base URL:

**Plain Text**

<https://merchants-api.cdon.com/api/>

**Technical Requirements**

**Request Format**

- All requests must use JSON format
- Set Content-Type header to application/json
- TLS 1.1 or higher required (TLS 1.2 recommended)
- TLS 1.0 is not supported

**Response Format**

All API responses return data in JSON format unless otherwise specified.


**Username**

{{merchantId}}

**Password**

{{apiToken}}

**ARTICLES**

In our API, an "article" is the fundamental unit of inventory-a unique product being sold on the marketplace with specific attributes, identified by a unique SKU (Stock Keeping Unit). For example, a specific red t-shirt in size medium with its own inventory count.

We use the term "product" to refer to the logical grouping of related articles. For instance, a t-shirt available in multiple colors and sizes is considered a single product, while each specific color-size combination represents an individual article.

Each article within a product uses its own unique data and can have different pictures, descriptions, pricings.

Under PARAMETERS you will find information on the parameters of the article model, following that you find more information regarding the product-article model under VARIATIONS.

**ARTICLES**

In our API, an "article" is the fundamental unit of inventory-a unique product being sold on the marketplace with specific attributes, identified by a unique SKU (Stock Keeping Unit). For example, a specific red t-shirt in size medium with its own inventory count.

We use the term "product" to refer to the logical grouping of related articles. For instance, a t-shirt available in multiple colors and sizes is considered a single product, while each specific color-size combination represents an individual article.

Each article within a product uses its own unique data and can have different pictures, descriptions, pricings.

Under PARAMETERS you will find information on the parameters of the article model, following that you find more information regarding the product-article model under VARIATIONS.

**PARAMETERS**

**Parameter Overview**

**Required Parameters**
| Parameter     | Description                    | Data type                        | Market Specific |
|---------------|--------------------------------|----------------------------------|-----------------|
| sku           | Your unique ID for the article | String (1-64)                    | No              |
| status        | Sale status for the article    | String ("for sale" or "paused")  | No              |
| quantity      | Quantity in stock              | Non-negative Integer (0-500 000) | No              |
| main_image    | Direct link to main image      | String (1-1500), valid URL       | No              |
| markets       | Countries for sale             | See Supported Market Codes       | No              |
| title         | Article name                   | See Title and Description        | No*             |
| description   | Detailed description           | See Title and Description        | No*             |
| price         | Article price                  | See Prices                       | Yes             |
| shipping_time | Delivery time to customer      | See Shipping                     | Yes             |

**Optional Parameters**
| Parameter              | Description                       | Data type                             | Market Specific |
|------------------------|-----------------------------------|---------------------------------------|-----------------|
| parent_sku             | Group-identifier for product      | String (1-64)                         | No              |
| category               | Category of the article           | String                                | No              |
| properties             | Article properties                | See Properties                        | No*             |
| variational_properties | Properties for variations         | See VARIATIONS                        | No              |
| brand                  | Manufacturer                      | String (1-50)                         | No              |
| gtin                   | Global identifier                 | String (1-13)                         | No              |
| images                 | Additional image links            | List of strings (1-1500), max 10 URLs | No              |
| unique_selling_points  | Key selling points                | See Unique Selling Points             | Yes             |
| specifications         | Technical specs                   | See Specifications                    | Yes             |
| classifications        | Classification attributes         | See Classifications                   | No              |
| delivery_type          | Delivery method                   | See Delivery                          | Yes             |
| kn_number              | Combined nomenclature code        | String (1-48)                         | No              |
| shipped_from           |                                   | "EU"/"NON_EU"                         | No              |
| manufacturer           | Detailed manufacturer information | See Manufacturer                      | No              |

**Standard Codes Reference**

**Supported Market Codes**

CDON currently supports the following markets:
| Market Code | Country |
|-------------|---------|
| SE          | Sweden  |
| DK          | Denmark |
| FI          | Finland |
| NO          | Norway  |

All market codes use the [ISO-3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) country code standard.

**Supported Language Codes**

Language codes use the combined language-region format:
| Language Code | Description             |
|---------------|-------------------------|
| sv-SE         | Swedish (Sweden)        |
| en-US         | English (United States) |
| da-DK         | Danish (Denmark)        |
| fi-FI         | Finnish (Finland)       |
| nb-NO         | Norwegian (Norway)      |

The format follows:

- Language: [ISO-639-1](https://en.wikipedia.org/wiki/ISO_639-1) two-letter language code
- Region: [ISO-3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) two-letter country code
- Combined with a hyphen, for example: "en-US"

**Supported Currency Codes**

The following currency codes are supported:
| Currency Code | Description     | Associated Market |
|---------------|-----------------|-------------------|
| SEK           | Swedish Krona   | SE                |
| DKK           | Danish Krone    | DK                |
| EUR           | Euro            | FI                |
| NOK           | Norwegian Krone | NO                |

All currency codes use the [ISO-4217](https://en.wikipedia.org/wiki/ISO_4217) standard.

**Basic Fields**

**Category**

The category is specified as a single string value of the category ID:

**json**

{

"category": "1124"

}

**Properties**

Properties are key/value pairs defined by the marketplace, divided into three types:

- **Free Text Properties**
  - Requires language specification (use supported language codes)
  - Values supplied as strings
- **Pre-defined Value Properties**
  - Values chosen from CDON-controlled list
- **Numerical Properties**
  - Values as integers or decimals in string format

Property Structure:
| Field    | Type          | Required           |
|----------|---------------|--------------------|
| name     | String        | Yes                |
| value    | String (1-36) | Yes                |
| language | String (5)    | Only for free text |

Example:

{

"properties": \[

{

"name": "color",

"value": "Deep Green",

"language": "en-US"

},

{

"name": "size",

"value": "xxl"

},

{

"name": "weight_kg",

"value": "0.5"

}

\]

}

**Free Text Properties**

These properties allow custom string values with some validation constraints:
| Property Name   | Description        | Constraints                   |
|-----------------|--------------------|-------------------------------|
| color           | Product color      | Min length: 1, Max length: 36 |
| connection_type | Type of connection | Min length: 1, Max length: 36 |
| flavor          | Product flavor     | Min length: 1, Max length: 36 |
| material        | Product material   | Min length: 1, Max length: 36 |
| pattern         | Product pattern    | Min length: 1, Max length: 36 |
| phone_case_type | Type of phone case | Min length: 1, Max length: 36 |
| size            | Product size       | Min length: 1, Max length: 36 |

**Predefined Properties**

These properties require specific enumerated values:

**preset-color**

- red
- blue
- green
- orange
- yellow
- purple
- pink
- gold
- silver
- multicolor
- white
- gray
- black
- turquoise
- brown
- beige
- transparent

**preset-connection_type**

- bluetooth
- usb-c
- micro-usb
- lightning
- 3.5mm

**preset-hair_type**

- dry hair
- normal hair
- curly hair
- damaged hair
- frizzy hair
- fine hair
- dry scalp
- dyed hair

**preset-media_format**

- dvd
- blu-ray
- 4k ultra hd
- cd
- vinyl

**preset-pattern**

- abstract and geometry
- animals and animal patterns
- nature and environment
- plants and fruit
- space and scifi
- text and quotes
- camouflage
- glitter
- marble and stone
- vehicles
- flags and symbols
- maps
- characters and celebrities
- fantasy
- retro

**preset-refurb_grading**

- a+
- a
- b
- c

**preset-refurb_warranty**

- 2 - 2 months warranty
- 6 - 6 months warranty
- 12 - 12 months warranty
- 24 - 24 months warranty

**preset-size_SML**

- one size
- xxs
- xs
- s
- m
- l
- xl
- xxl

**preset-skin_type**

- dry skin
- normal skin
- mature skin
- oily skin
- mixed skin
- acne

**Numerical Properties**

These properties expect numerical or formatted values:
| Property Name   | Description        | Constraints                   |
|-----------------|--------------------|-------------------------------|
| color           | Product color      | Min length: 1, Max length: 36 |
| connection_type | Type of connection | Min length: 1, Max length: 36 |
| flavor          | Product flavor     | Min length: 1, Max length: 36 |
| material        | Product material   | Min length: 1, Max length: 36 |
| pattern         | Product pattern    | Min length: 1, Max length: 36 |
| phone_case_type | Type of phone case | Min length: 1, Max length: 36 |
| size            | Product size       | Min length: 1, Max length: 36 |

**Market-Related Fields**

**Markets**

Specifies available sale countries. Use the supported market codes for specifying which markets the article should be available in.

Example:

**json**

{

"markets": \["SE", "DK"\]

}

**Prices**

Market-specific pricing with VAT included. Use supported market codes and supported currency codes.
| Field                | Type          | Required | Notes                                       |
|----------------------|---------------|----------|---------------------------------------------|
| market               | String (2)    | Yes      | Market code from supported market codes     |
| amount_including_vat | Decimal (1-7) | Yes      |                                             |
| currency             | String (3)    | Yes      | Currency code from supported currency codes |
| vat_rate             | Decimal       | No       | Default: market rate                        |

Example:

{

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

}

\]

}

**Shipping**

Specifies delivery time range per market. Use market codes from supported market codes.
| Field  | Type        | Required |
|--------|-------------|----------|
| market | String (2)  | Yes      |
| min    | Integer 1-9 | Yes      |
| max    | Integer 1-9 | Yes      |

Example:

{

"shipping_time": \[

{

"market": "SE",

"min": 2,

"max": 5

},

{

"market": "DK",

"min": 4,

"max": 9

}

\]

}

**Delivery**

Specifies delivery method per market. Use market codes from supported market codes. Available types:

- mailbox
- service_point
- home_delivery

Example:

**json**

{

"delivery_type": \[

{"market": "SE", "value": "mailbox"},

{"market": "DK", "value": "service_point"}

\]

}

**Content Fields**

**Title and Description**

Uses combined language-region format as specified in supported language codes.

Field Constraints:

- title: String (5-150 characters)
- description: String (10-4096 characters)

Example:

{

"title": \[

{

"language": "sv-SE",

"value": "This is the title in Swedish"

},

{

"language": "en-US",

"value": "This is the title in English"

}

\]

}

**Unique Selling Points**

Language-specific selling points. Use language codes from supported language codes.
| Field    | Type                                |
|----------|-------------------------------------|
| language | String (5)                          |
| value    | List of strings (max 30 chars each) |

Example:

{

"unique_selling_points": \[

{

"language": "en-US",

"value": \[

"Water resistant",

"Long battery life"

\]

},

{

"language": "sv-SE",

"value": \[

"Vattenbeständig",

"Lång batteritid"

\]

}

\]

}

**Additional Specifications**

**Specifications**

Technical details organized by language and sections. Use language codes from supported language codes.

Structure:

- Language specification
- Sections containing attributes
- Each attribute has name, value, and description

Example:

{

"specifications": \[

{

"language": "en-US",

"value": \[

{

"name": "Technical Details",

"value": \[

{

"name": "Screen size",

"value": "6.1 inch",

"description": "Screen size measured diagonally"

},

{

"name": "Battery capacity",

"value": "4500mAh"

}

\]

}

\]

}

\]

}

**Classifications**

Product classification attributes.

Example:

**json**

{

"classifications": \[

{

"name": "CONDITION",

"value": "REFURB"

}

\]

}

**CONDITION Classification**

The CONDITION classification describes the condition of the product.

**json**

{

"name": "CONDITION",

"value": "\[condition value\]"

}

Possible values:

- NEW - Brand new product
- REFURB - Refurbished product

**RESTRICTED Classification**

The RESTRICTED classification indicates if a product has age or other restrictions.

**json**

{

"name": "RESTRICTED",

"value": "\[restricted value\]"

}

Possible values:

- ADULT - Adult-only product

**Manufacturer**

Provides detailed information about the product manufacturer.
| Field              | Type   | Required | Notes                                  |
|--------------------|--------|----------|----------------------------------------|
| name               | String | Yes      | Company name of the manufacturer       |
| address            | Object | Yes      | Physical address of the manufacturer   |
| website            | String | No       | Manufacturer's website URL             |
| email              | String | No       | Contact email for the manufacturer     |
| responsible_person | Object | No       | Required if manufacturer is outside EU |

**Address Structure:**
| Field          | Type       | Required |
|----------------|------------|----------|
| street_address | String     | Yes      |
| city           | String     | Yes      |
| postal_code    | String     | Yes      |
| country        | String (2) | Yes      |

**Responsible Person Structure (only needed if manufacturer outside EU):**
| Field | Type   | Required |
|-------|--------|----------|
| name  | String | Yes      |
| phone | String | No       |
| email | String | No       |

Example:

{

"manufacturer": {

"name": "Manufacturer Company Name",

"address": {

"street_address": "123 Manufacturing Street",

"city": "Industrial City",

"postal_code": "12345",

"country": "SE"

},

"website": "<https://manufacturer.example.com>",

"email": "<contact@manufacturer.example.com>",

"responsible_person": {

"name": "EU representative",

"phone": "+234-567-8900",

"email": "<responsible@eu-manufacturer.com>"

}

}

}

**VARIATIONS**

**Product Variation Model**

**Overview**

CDON supports a flexible product variation model that allows merchants to organize related products (such as different sizes or colors of the same item) using an article group relationship structure. This document explains how to properly use this variation model.

**Key Components**

**1\. Variational Relationship**

Articles that are variants of each other are grouped using a article group relationship, also known as product:

- **parent_sku**: Identifies the product that all variations belong to
- **sku**: Each individual variant has its own unique SKU
- **properties**: Define characteristics of each variant
- **variational_properties**: Specify which properties differentiate the variants

**Implementation Details**

**Parent SKU**

The parent_sku parameter serves as a group identifier that must be specified for all articles that should be grouped together. The parent_sku value doesn't have to correspond to the SKU of an actual article - it can be any string value that logically represents the product.

**json**

{

"sku": "SHIRT-RED-M",

"parent_sku": "SHIRT-BASIC"

}

**Important Notes:**

- The parent_sku parameter is **required** for all articles that should be grouped together
- All variants of the same product must share the exact same parent_sku value
- The parent_sku can be a logical identifier that doesn't match any actual article SKU

For example, you might have three variants (RED-S, RED-M, RED-L) all sharing the parent_sku "RED-SHIRT-GROUP" without needing to have a article with the SKU "RED-SHIRT-GROUP" in your inventory.

**Properties and Variational Properties**

To properly implement a variation model, you need to understand the relationship between properties and variational properties:

- **properties**: These define all characteristics of an article (color, size, material, etc.)
- **variational_properties**: These specify which of those properties actually differentiate the variants from each other

**Properties**

All articles should have their properties defined as key-value pairs:

{

"properties": \[

{

"name": "color",

"value": "Red",

"language": "en-US"

},

{

"name": "size",

"value": "M"

},

{

"name": "material",

"value": "Cotton"

}

\]

}

**Variational Properties**

For proper variation handling, you must specify which of these properties constitute the actual variations:

**json**

{

"variational_properties": \["color", "size"\]

}

This tells the system that "color" and "size" are what differentiate the variants from each other, while other properties like "material" are constant or not relevant to the variation.

**Complete Example**

Here's how a product variation family would be structured, focusing on the fields most relevant to the variation model:

**Parent Product Identifier**

**json**

{

"sku": "TSHIRT-BASIC",

"parent_sku": "TSHIRT-BASIC-GROUP"

}

Note that in this example, we're using a parent_sku that doesn't match the SKU. This is perfectly valid - the parent_sku is simply a logical grouping identifier.

**Variant Examples**

**Variant 1: Red Small T-Shirt**

**json**

{

"sku": "TSHIRT-RED-S",

"parent_sku": "TSHIRT-BASIC-GROUP",

"properties": \[

{

"name": "color",

"value": "Red",

"language": "en-US"

},

{

"name": "size",

"value": "S"

},

{

"name": "material",

"value": "Cotton"

}

\],

"variational_properties": \["color", "size"\]

}

**Variant 2: Blue Medium T-Shirt**

{

"sku": "TSHIRT-BLUE-M",

"parent_sku": "TSHIRT-BASIC-GROUP",

"properties": \[

{

"name": "color",

"value": "Blue",

"language": "en-US"

},

{

"name": "size",

"value": "M"

},

{

"name": "material",

"value": "Cotton"

}

\],

"variational_properties": \["color", "size"\]

}

**Variant 3: Blue Small T-Shirt**

{

"sku": "TSHIRT-BLUE-S",

"parent_sku": "TSHIRT-BASIC-GROUP",

"properties": \[

{

"name": "color",

"value": "Blue",

"language": "en-US"

},

{

"name": "size",

"value": "S"

},

{

"name": "material",

"value": "Cotton"

}

\],

"variational_properties": \["color", "size"\]

}

**Key Points to Notice**

- All variants share the exact same parent_sku value: "TSHIRT-BASIC-GROUP"
- Each variant has a unique sku value
- All variants have the same properties defined, but with different values for the variational properties
- The variational_properties array is identical for all variants and specifies which properties constitute the variation
- Non-variational properties like "material" have the same value across all variants but are still included in each variant's properties

Remember that in a complete article submission, you would include all required fields as specified in the API documentation, such as category, status, quantity, markets, prices, etc. The above examples focus only on the fields relevant to the variation model.

**Best Practices**

- **Consistent Naming Convention**: Use a logical naming convention for SKUs that reflects the variation relationship.
- **Appropriate Property Selection**: Only include properties in variational_properties that actually differentiate variants.
- **Complete Properties**: Ensure all variants have all the necessary properties defined, even if some aren't variational.
- **Images**: Each variant should have its own specific main image that accurately represents that variant.
- **Inventory Management**: Each variant maintains its own inventory through the quantity field.
- **Variation-Specific Titles**: Consider having variant-specific titles that include the variation properties (e.g., "Red T-Shirt, Size M").

**Troubleshooting**

If variants aren't appearing correctly grouped:

- Verify all variants share the exact same parent_sku value
- Check that variational_properties correctly lists all differentiating properties
- Ensure all variants have the correct properties defined
- Confirm that all variants belong to the same category

**  
POST Create Articles Bulk**

{{baseUrl}}/v2/articles/bulk

The POST request to this endpoint allows you to bulk upload articles.

**Request Body**

- articles (array): An array of articles, see ARTICLES or examples for more information on the article structure.

**Response**

The response will include a success array containing the IDs and SKUs of successfully added articles, and a failed array for any articles that failed to be added. Each failed article will have its SKU and an array of errors with messages and fields that caused the failure.

**HEADERS**

|              |                  |
|--------------|------------------|
| Content-Type | application/json |
| Accept       | application/json |

**Body** raw (json)

{

"articles": \[

{

"description": \[

{

"language": "&lt;language_code&gt;",

"value": "&lt;string&gt;"

}

\],

"main_image": "&lt;uri&gt;",

"markets": \[

"&lt;market_code&gt;"

\],

"price": \[

{

"market": "&lt;market_code&gt;",

"value": {

"amount_including_vat": {

"value": "&lt;number&gt;"

},

"currency": {

"value": "&lt;currency_code&gt;"

},

"vat_rate": {

"value": "&lt;number&gt;"

}

}

}

\],

"quantity": "&lt;integer&gt;",

"shipping_time": \[

{

"market": "&lt;market_code&gt;",

"min": "&lt;integer&gt;",

"max": "&lt;integer&gt;"

}

\],

"sku": "&lt;string&gt;",

"status": "&lt;string&gt;",

"title": \[

{

"language": "&lt;language_code&gt;",

"value": "&lt;string&gt;"

}

\],

"availability_dates": \[

{

"market": "&lt;market_code&gt;",

"value": "&lt;string&gt;"

}

\],

"brand": "&lt;string&gt;",

"category": "&lt;string&gt;",

"classifications": \[

{

"name": "&lt;string&gt;",

"value": "&lt;string&gt;"

}

\],

"delivery_type": \[

{

"market": "&lt;market_code&gt;",

"value": "&lt;string&gt;"

}

\],

"gtin": "&lt;string&gt;",

"images": \[

"&lt;uri&gt;"

\],

"internal_note": "&lt;string&gt;",

"kn_number": "&lt;string&gt;",

"manufacturer": {

"name": "&lt;string&gt;",

"address": {

"street_address": "&lt;string&gt;",

"city": "&lt;string&gt;",

"postal_code": "&lt;string&gt;",

"country": "&lt;string&gt;"

},

"website": "&lt;uri&gt;",

"email": "&lt;email&gt;",

"responsible_person": {

"name": "&lt;string&gt;",

"phone": "&lt;string&gt;",

"email": "&lt;string&gt;"

}

},

"mpn": "&lt;string&gt;",

"parent_sku": "&lt;string&gt;",

"properties": \[

{

"value": "&lt;string&gt;",

"language": "&lt;language_code&gt;",

"name": "&lt;string&gt;"

}

\],

"shipped_from": "&lt;string&gt;",

"specifications": \[

{

"language": "&lt;language_code&gt;",

"value": \[

{

"name": "&lt;string&gt;",

"value": \[

{

"name": "&lt;string&gt;",

"value": "&lt;string&gt;",

"description": "&lt;string&gt;"

}

\]

}

\]

}

\],

"unique_selling_points": \[

{

"language": "&lt;language_code&gt;",

"value": \[

"&lt;string&gt;"

\]

}

\],

"variational_properties": \[

"&lt;string&gt;"

\]

}

\]

}

**Example Request - Successful creation**

curl --location -g '{{baseUrl}}/v2/articles/bulk' \\

\--header 'Content-Type: application/json' \\

\--data '{

"articles": \[

{

"sku": "article-123",

"status": "for sale",

"quantity": 100,

"main_image": "<https://example.com/image.jpg>",

"markets": \[

"SE",

"DK"

\],

"price": \[

{

"market": "SE",

"value": {

"amount_including_vat": 199.99,

"currency": "SEK",

"vat_rate": 0.25

}

},

{

"market": "DK",

"value": {

"amount_including_vat": 149.99,

"currency": "DKK",

"vat_rate": 0.25

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 1,

"max": 3

},

{

"market": "DK",

"min": 2,

"max": 5

}

\],

"title": \[

{

"language": "sv-SE",

"value": "Titel på svenska"

},

{

"language": "en-US",

"value": "Title in English"

}

\],

"description": \[

{

"language": "sv-SE",

"value": "Beskrivning på svenska"

},

{

"language": "en-US",

"value": "Description in English"

}

\],

"category": "1124",

"properties": \[

{

"name": "color",

"value": "Deep Green",

"language": "en-US"

},

{

"name": "preset-size_SML",

"value": "s"

}

\]

}

\]

}'

**Example Response - 202 ACCEPTED**

{

"batch_id": "41675f63-0187-429a-a651-70e8174fe725",

"success": \[

{

"id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",

"sku": "article-123"

}

\],

"failed": \[\]

}

**Headers**

Content-Type

application/json

**Example request - Partial Success**

curl --location -g '{{baseUrl}}/v2/articles/bulk' \\

\--header 'Content-Type: application/json' \\

\--data '{

"articles": \[

{

"sku": "valid-article",

"status": "for sale",

"quantity": 100,

"main_image": "<https://example.com/image.jpg>",

"markets": \[

"SE",

"DK"

\],

"price": \[

{

"market": "SE",

"value": {

"amount_including_vat": 199.99,

"currency": "SEK",

"vat_rate": 0.25

}

}

\],

"shipping_time": \[

{

"market": "SE",

"min": 1,

"max": 3

}

\],

"title": \[

{

"language": "sv-SE",

"value": "Titel på svenska"

}

\],

"description": \[

{

"language": "sv-SE",

"value": "Beskrivning på svenska"

}

\],

"category": "1124"

},

{

"sku": "invalid-article",

"status": "for sale",

"quantity": 100

// Missing required fields

}

\]

}'

**Example Response - 202 ACCEPTED**

{

"batch_id": "41675f63-0187-429a-a651-70e8174fe725",

"success": \[

{

"id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",

"sku": "valid-article"

}

\],

"failed": \[

{

"sku": "invalid-article",

"errors": \[

{

"message": "Required field missing",

"field": \[

"main_image"

\]

},

{

"message": "Required field missing",

"field": \[

"markets"

\]

},

{

"message": "Required field missing",

"field": \[

"price"

\]

},

{

"message": "Required field missing",

"field": \[

"shipping_time"

\]

},

{

"message": "Required field missing",

"field": \[

"title"

\]

},

{

"message": "Required field missing",

"field": \[

"description"

\]

}

\]

}

\]

}

**Headers**

Content-Type

application/json

**PUT Update Articles Bulk**

{{baseUrl}}/v2/articles/bulk

**Update Multiple Articles**

This bulk update endpoint (PUT /v2/articles/bulk) supports multiple action types, each requiring a different body structure. This document outlines the required fields and structure for each action type.

**Request Structure**

All bulk update requests follow this general structure:

**json**

{

"actions": \[

{

"sku": "&lt;article_sku&gt;",

"action": "&lt;action_type&gt;",

"body": {

// Fields vary based on action type

}

}

\]

}

**Action Types and Their Required Body Structures**

**1\. update_article**

Used for comprehensive article updates.

**Required Fields:** status, main_image, markets, shipping_time, title, description

**Example Body:**

**json**

{

"status": "&lt;string&gt;",

"main_image": "&lt;uri&gt;",

"markets": \["&lt;market_code&gt;"\],

"shipping_time": \[

{

"market": "&lt;market_code&gt;",

"min": &lt;integer&gt;,

"max": &lt;integer&gt;

}

\],

"title": \[

{

"language": "&lt;language_code&gt;",

"value": "&lt;string&gt;"

}

\],

"description": \[

{

"language": "&lt;language_code&gt;",

"value": "&lt;string&gt;"

}

\]

}

**Optional Fields:** All other article fields with the exception of price and quantity which are not allowed.

**2\. update_article_price**

Used solely for updating an article's price information.

**Required Fields:** price

**Example Body:**

**json**

{

"price": \[

{

"market": "&lt;market_code&gt;",

"value": {

"amount_including_vat": &lt;decimal&gt;,

"currency": "&lt;currency_code&gt;",

"vat_rate": &lt;decimal&gt;

}

}

\]

}

**3\. update_article_quantity**

Used solely for updating an article's stock quantity.

**Required Fields:** quantity

**Example Body:**

**json**

{

"quantity": &lt;integer&gt;

}

**4\. delete_article**

Used for removing an article from the system.

**Required Fields:** None

**Example Body:** No body required

**Key Points**

- The required fields in the body depend on the action type specified
- Fields not relevant to the action should be omitted
- Multiple different action types can be included in a single request
- The API validates each action independently
- The response will include success and failure information for each action

**Response Format**

The API returns information about which actions succeeded and which failed:

**json**

{

"success": \[

{

"sku": "&lt;article_sku&gt;",

"action": "&lt;action_type&gt;"

}

\],

"failed": \[

{

"sku": "&lt;article_sku&gt;",

"action": "&lt;action_type&gt;",

"errors": \[

{

"message": "&lt;error_message&gt;",

"field": \["&lt;field_name&gt;"\]

}

\]

}

\]

}

**HEADERS**

|              |                  |
|--------------|------------------|
| Content-Type | application/json |
| Accept       | application/json |

**Body** raw (json)

**json**

{

"actions": \[

{

"sku": "&lt;string&gt;",

"action": "update_article",

"body": {

"status": "&lt;string&gt;",

"main_image": "&lt;uri&gt;",

"markets": \["&lt;market_code&gt;"\],

"shipping_time": \[

{

"market": "&lt;market_code&gt;",

"min": "&lt;integer&gt;",

"max": "&lt;integer&gt;"

}

\],

"title": \[

{

"language": "&lt;language_code&gt;",

"value": "&lt;string&gt;"

}

\],

"description": \[

{

"language": "&lt;language_code&gt;",

"value": "&lt;string&gt;"

}

\],

"category": "&lt;string&gt;",

"brand": "&lt;string&gt;",

"gtin": "&lt;string&gt;",

"images": \["&lt;uri&gt;"\],

"properties": \[

{

"name": "&lt;string&gt;",

"value": "&lt;string&gt;",

"language": "&lt;language_code&gt;"

}

\],

"parent_sku": "&lt;string&gt;",

"internal_note": "&lt;string&gt;"

}

},

{

"sku": "&lt;string&gt;",

"action": "update_article_price",

"body": {

"price": \[

{

"market": "&lt;market_code&gt;",

"value": {

"amount_including_vat": "&lt;number&gt;",

"currency": "&lt;currency_code&gt;",

"vat_rate": "&lt;number&gt;"

}

}

\]

}

},

{

"sku": "&lt;string&gt;",

"action": "update_article_quantity",

"body": {

"quantity": "&lt;integer&gt;"

}

},

{

"sku": "&lt;string&gt;",

"action": "delete_article"

}

\]

}

**Example Request - Successful update**

curl --location -g --request PUT '{{baseUrl}}/v2/articles/bulk' \\

\--header 'Content-Type: application/json' \\

\--data '{

"actions": \[

{

"sku": "article-123",

"action": "update_article",

"body": {

"status": "for sale",

"main_image": "<https://example.com/image.jpg>",

"markets": \[

"SE",

"DK"

\],

"shipping_time": \[

{

"market": "SE",

"min": 1,

"max": 3

},

{

"market": "DK",

"min": 2,

"max": 5

}

\],

"title": \[

{

"language": "sv-SE",

"value": "Uppdaterad titel på svenska"

},

{

"language": "en-US",

"value": "Updated title in English"

}

\],

"description": \[

{

"language": "sv-SE",

"value": "Uppdaterad beskrivning på svenska"

},

{

"language": "en-US",

"value": "Updated description in English"

}

\]

}

},

{

"sku": "article-456",

"action": "update_article_price",

"body": {

"price": \[

{

"market": "SE",

"value": {

"amount_including_vat": 299.99,

"currency": "SEK",

"vat_rate": 0.25

}

}

\]

}

},

{

"sku": "article-789",

"action": "update_article_quantity",

"body": {

"quantity": 42

}

},

{

"sku": "article-999",

"action": "delete_article"

}

\]

}'

**Example Response - 202 ACCEPTED**

{

"batch_id": "41675f63-0187-429a-a651-70e8174fe725",

"success": \[

{

"sku": "article-123",

"action": "update_article"

},

{

"sku": "article-456",

"action": "update_article_price"

},

{

"sku": "article-789",

"action": "update_article_quantity"

},

{

"sku": "article-999",

"action": "delete_article"

}

\],

"failed": \[\]

}

**Headers**

Content-Type

application/json

**Example Request - Partial update success**

curl --location -g --request PUT '{{baseUrl}}/v2/articles/bulk' \\

\--header 'Content-Type: application/json' \\

\--data '{

"actions": \[

{

"sku": "valid-article",

"action": "update_article_price",

"body": {

"price": \[

{

"market": "SE",

"value": {

"amount_including_vat": 299.99,

"currency": "SEK",

"vat_rate": 0.25

}

}

\]

}

},

{

"sku": "non-existent-article",

"action": "update_article_quantity",

"body": {

"quantity": 42

}

},

{

"sku": "valid-article-2",

"action": "update_article",

"body": {

"status": "for sale",

"title": \[

{

"language": "en-US",

"value": "Updated title"

}

\]

// Missing required fields

}

}

\]

}'

**Example Response - 202 ACCEPTED**

{

"batch_id": "41675f63-0187-429a-a651-70e8174fe725",

"success": \[

{

"sku": "valid-article",

"action": "update_article_price"

}

\],

"failed": \[

{

"sku": "non-existent-article",

"action": "update_article_quantity",

"errors": \[

{

"message": "Article not found",

"field": \[

"sku"

\]

}

\]

},

{

"sku": "valid-article-2",

"action": "update_article",

"errors": \[

{

"message": "Required field missing",

"field": \[

"main_image"

\]

},

{

"message": "Required field missing",

"field": \[

"markets"

\]

},

{

"message": "Required field missing",

"field": \[

"shipping_time"

\]

},

{

"message": "Required field missing",

"field": \[

"description"

\]

}

\]

}

\]

}

**Headers**

Content-Type

application/json

**ORDERS**

**Order attributes**

As soon as a customer completes an order of one of your articles, we will make the order information available via the resource **ORDERS**. It will include the necessary information regarding both the item that was sold and the customer who made the purchase.

Each order will contain only one SKU, with possible quantity (>1).
| Parameter        | Description                                                |
|------------------|------------------------------------------------------------|
| id               | Unique ID for the order (read only)                        |
| article_id       | Unique ID for the ordered article (read only)              |
| article_title    | Name of the ordered article (read only)                    |
| article_sku      | Your unique ID for the ordered article (read only)         |
| market           | Market the order was made on (read only)                   |
| article_price    | Price of the ordered item (excluding shipping) (read only) |
| article_vat_rate | VAT rate for the ordered article (read only)               |
| quantity         | Number of article units ordered (read only)                |
| total_price      | Full amount of the order (read only)                       |
| shipping_address | Customer information (read only)                           |
| created_at       | Date the order was created on, UTC (read only)             |
| fulfill_before   | Date the order must be fulfilled by, UTC (read only)       |
| state            | Order state                                                |

**Quantity / Price**

In case of an order with several quantity, the price do not represent the unit price but the price for all quantities.

article_price = unit price \\\\\* quantity

total_price = article_price

**NOTE:** All transactions are handled in the customer's local currency.

**Shipping Address**

| Parameter      | Description                                        |
|----------------|----------------------------------------------------|
| full_name      | Customer full name                                 |
| first_name     | Customer first name (not available in a B2B order) |
| last_name      | Customer last name (not available in a B2B order)  |
| street_address | Customer street address                            |
| postal_code    | Customer postal code                               |
| city           | Customer city                                      |
| country        | Customer country                                   |
| phone_number   | Customer phone number                              |

**State**

In return, you are to inform us on the actions you are taking for the order. In most cases you will ship the package and therefore fulfill the order. In some cases you might need to cancel the order.
| State         | Description                                                                             |
|---------------|-----------------------------------------------------------------------------------------|
| CREATED       | New order, to be handled                                                                |
| ACCEPTED      | Order has been accepted, must be fulfilled and delivered within the given delivery time |
| FULFILLED     | Order has been handled, item has been shipped                                           |
| NOT_FULFILLED | Order has been cancelled, customer has been refunded                                    |
The following calls will give you the ability to handle a single order as per above flow.  
**Please note that once an order has entered the state** **fulfilled** **or** **not_fulfilled**, **the order state can no longer be modified.**

**GET Retrieve an order**

{{baseUrl}}/v1/orders/{{order_id}}

**Definition**

This endpoint will allow you to retrieve an order.

**Request query parameters**
| Parameter | Description             | Required |
|-----------|-------------------------|----------|
| order_id  | Unique ID for the order | Yes      |

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

**Example Request - 200 Successful call**

curl --location -g '{{baseUrl}}/v1/orders/{{order_id}}' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json'

**Example Response - 200 OK**

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"customer_order_id": "{{customer_order_id}}",

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
|                   |                                                                                                                                                 |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| Connection        | keep-alive                                                                                                                                      |
|                   | Options that are desired for the connection                                                                                                     |
| Content-Encoding  | gzip                                                                                                                                            |
|                   | The type of encoding used on the data.                                                                                                          |
| Content-Type      | text/html                                                                                                                                       |
|                   | The mime type of this content                                                                                                                   |
| Date              | Wed, 10 Jan 2018 15:00:54 GMT                                                                                                                   |
|                   | The date and time that the message was sent                                                                                                     |
| Server            | nginx                                                                                                                                           |
|                   | A name for the server                                                                                                                           |
| Transfer-Encoding | chunked                                                                                                                                         |
|                   | The form of encoding used to safely transfer the entity to the user. Currently defined methods are: chunked, compress, deflate, gzip, identity. |
| X-Request-ID      | 221377f8b27e363e8e5968e90894404d                                                                                                                |
|                   | Custom header                                                                                                                                   |

**GET List orders**

{{baseUrl}}/v1/orders/

**Definition**

This endpoint will allow you to retrieve your order data.

**Query parameters**

**Filtering**

The field state supports filtering. **By default, we return new orders (orders in state CREATED)**.
| Filter values | Definition         |
|---------------|--------------------|
| CREATED       | New order          |
| ACCEPTED      | Accepted           |
| FULFILLED     | Handled/shipped    |
| NOT_FULFILLED | Cancelled/refunded |

**Pagination**

We return 100 orders by default and you can retrieve up to 1000 orders per page by using pagination parameters.
| Parameter | Default value | Required |
|-----------|---------------|----------|
| limit     | 100           | No       |
| page      | 1             | No       |
**You may combine pagination and filtering.**


**Response**

Order objects will be returned, as per the settings of your request. See response samples on the right hand-side column.

**Example Request - List cancelled orders**

curl --location -g '{{baseUrl}}/v1/orders?state=NOT_FULFILLED'

**Example Response - 200 OK**

\[

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"customer_order_id": "{{customer_order_id}}",

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

"customer_order_id": "{{customer_order_id}}",

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

**Headers**

**No response headers**

This request doesn't return any response headers

**Example Request - List new orders**

curl --location -g '{{baseUrl}}/v1/orders?state=CREATED'

**Example Response - 200 OK**

\[

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"customer_order_id": "{{customer_order_id}}",

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

**Headers**

**No response headers**

This request doesn't return any response headers

**Example Request - List fulfilled orders**

curl --location -g '{{baseUrl}}/v1/orders?state=FULFILLED'

**Example Response - 200 OK**

\[

{

"id": "{{order_id}}",

"article_id": "{{article_id}}",

"customer_order_id": "{{customer_order_id}}",

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

"customer_order_id": "{{customer_order_id}}",

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

**Headers**

**No response headers**

This request doesn't return any response headers

**PUT Accept an order**

{{baseUrl}}/v1/orders/{{order_id}}/accept

**Definition**

This endpoint will allow you to accept an order.

A request can be sent for one single order.

By running this call, you will set the order field state to **accepted**.

Any order that has already been cancelled or fulfilled cannot be accepted.

**Request query parameter**
| Parameter | Description                                | Required |
|-----------|--------------------------------------------|----------|
| order_id  | Unique ID for the order you want to accept | Yes      |

**Response**

**Plain Text**

{

"description": "Order row was accepted"

}

**HEADERS**

Content-Type

application/json

**Example Request - 202 Successful fulfillment**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/accept' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json'

**Example Response - 202 ACCEPTED**

{

"description": "Order row was accepted"

}

**Headers**
|                |                                                         |
|----------------|---------------------------------------------------------|
| Connection     | keep-alive                                              |
|                | Options that are desired for the connection             |
| Content-Length | 166                                                     |
|                | The length of the response body in octets (8-bit bytes) |
| Content-Type   | text/html                                               |
|                | The mime type of this content                           |
| Date           | Wed, 10 Jan 2018 15:00:54 GMT                           |
|                | The date and time that the message was sent             |
| Server         | nginx                                                   |
|                | A name for the server                                   |
| X-Request-ID   | 221377f8b27e363e8e5968e90894404d                        |
|                | Custom header                                           |

**Example Request - 403 Order is already accepted**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/accept' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json'

**Example Response - 403 FORBIDDEN**

{

"description": "Order row already has accepted as state"

}

**Headers**

**No response headers**

This request doesn't return any response headers

**Example Request - 403 Order is already fulfilled**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/accept' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response - 403 FORBIDDEN**

{

"description": "Order row already has fulfilled as state"

}

**Headers**

**No response headers**

This request doesn't return any response headers

**Example Request - 403 Order is already cancelled**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/accept' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json'

**Example Response - 403 FORBIDDEN**

{

"description": "Order row already has not_fulfilled as state"

}

**Headers**

**No response headers**

This request doesn't return any response headers

**Example Request - 403 Order has passed fulfillment date**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/accept' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json'

**Example Response - 403 FORBIDDEN**

{

"description": "Order has passed fulfillment due date"

}

**Headers**

**No response headers**

This request doesn't return any response headers

**PUT Fulfill an order**

{{baseUrl}}/v1/orders/{{order_id}}/fulfill

**Definition**

This endpoint will allow you to fulfill an order.

A request can be sent for one single order.

Mark the order as handled as soon as you have shipped the item.  
By running this call, you will set the order field state to **fulfilled**.

Any order that has already been cancelled cannot be fulfilled.

**Request query parameter**
| Parameter | Description                                 | Required |
|-----------|---------------------------------------------|----------|
| order_id  | Unique ID for the order you want to fulfill | Yes      |

**Adding tracking information**

If available the tracking information should be supplied in the body. For each object in the Tracking Information list the Tracking Number is required but Carrier is optional to supply.

**Example body with tracking information**

{

"tracking_information": \[

{

"carrier_name": "Postnord",

"tracking_number": "abc123"

},

{

"carrier_name": null,

"tracking_number": "def456"

},

{

"tracking_number": "ghi789"

}

\]

}

**Response**

**Plain Text**

{

"description": "Order row was fulfilled"

}

**HEADERS**

Content-Type

application/json

**Body** raw (json)

**json**

{

"tracking_information": \[

{

"carrier_name": "Postnord",

"tracking_number": "abc123"

},

{

"carrier_name": null,

"tracking_number": "def456"

},

{

"tracking_number": "ghi789"

}

\]

}

**Example Request - 202 Successful fulfillment**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/fulfill' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response - 202 ACCEPTED**

{

"description": "Order row was fulfilled"

}

**Headers**
|                |                                                         |
|----------------|---------------------------------------------------------|
| Connection     | keep-alive                                              |
|                | Options that are desired for the connection             |
| Content-Length | 166                                                     |
|                | The length of the response body in octets (8-bit bytes) |
| Content-Type   | text/html                                               |
|                | The mime type of this content                           |
| Date           | Wed, 10 Jan 2018 15:00:54 GMT                           |
|                | The date and time that the message was sent             |
| Server         | nginx                                                   |
|                | A name for the server                                   |
| X-Request-ID   | c6e2d4c1fe2ef4c9ef631977b9974421                        |
|                | Custom header                                           |

**Example Request - 403 Order is already fulfilled**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/fulfill' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response - 403 FORBIDDEN**

{

"description": "Order row already has fulfilled as state"

}

**Headers**

**No response headers**

This request doesn't return any response headers

**Example Request - 403 Order is already cancelled**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/fulfill' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response - 403 FORBIDDEN**

{

"description": "Order row already has not_fulfilled as state"

}

**Headers**

**No response headers**

This request doesn't return any response headers

**Example Request - 403 Order has passed fulfillment date**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/fulfill' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response - 403 FORBIDDEN**

{

"description": "Order has passed fulfillment due date"

}

**Headers**

**No response headers**

This request doesn't return any response headers

**PUT Cancel an order**

{{baseUrl}}/v1/orders/{{order_id}}/cancel

**Definition**

This endpoint will allow you to cancel an order.

This call should be used whenever you are unable to ship the item (for stock issue for example).  
It will set the order field state to **not_fulfilled**.

Any order that has already been fulfilled or accepted cannot be cancelled.

**Request query parameter**
| Parameter | Description                                | Required |
|-----------|--------------------------------------------|----------|
| order_id  | Unique ID for the order you want to cancel | Yes      |

**Response**

**Plain Text**

{

"description": "Order row was cancelled"

}

**Example Request - 403 Order is already cancelled**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/cancel' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response - 403 FORBIDDEN**

{

"description": "Order row already has not_fulfilled as state"

}

**Headers**

**No response headers**

This request doesn't return any response headers

**Example Request - 403 Order is already fulfilled**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/cancel' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response - 403 FORBIDDEN**

{

"description": "Order row already has fulfilled as state"

}

**Headers**

**No response headers**

This request doesn't return any response headers

**Example Request - 202 Successful cancellation**

curl --location -g --request PUT '{{baseUrl}}/v1/orders/{{order_id}}/cancel' \\

\--header 'Authorization: Basic {base64_encode(merchantID:token)}' \\

\--header 'Content-Type: application/json' \\

\--data ''

**Example Response - 202 ACCEPTED**

{

"description": "Order row was cancelled"

}

**Headers**
|                |                                                         |
|----------------|---------------------------------------------------------|
| Connection     | keep-alive                                              |
|                | Options that are desired for the connection             |
| Content-Length | 166                                                     |
|                | The length of the response body in octets (8-bit bytes) |
| Content-Type   | text/html                                               |
|                | The mime type of this content                           |
| Date           | Wed, 10 Jan 2018 15:00:54 GMT                           |
|                | The date and time that the message was sent             |
| Server         | nginx                                                   |
|                | A name for the server                                   |
| X-Request-ID   | 962ebde8e5656009157430db29927b61                        |
|                | Custom header                                           |

**CATEGORIES**

**GET List Categories**

{{baseUrl}}/v1/categories/{{market}}/{{language}}/

**Definition**

This endpoint will allow you to retrieve the category tree for CDON articles.

**URL Structure**

When fetching the category tree you will need to supply market and language for the tree you want to fetch.

<https://merchants-api.cdon.com/api/v1/categories/SE/en-US/> will fetch the tree for the Swedish market in English, changing en-US to sv-SE will fetch the same tree but with Swedish names.

**Response**

The category tree will be returned as a list where each node has the following attributes:
| Attribute            | Description                                                                         |
|----------------------|-------------------------------------------------------------------------------------|
| id                   | The ID of the category.                                                             |
| name                 | Name of the category.                                                               |
| path                 | The path from the ancestor root category to the current category separated by dots. |
| search_friendly_name | Search friendly name, if available.                                                 |

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

**Example Request - List Categories**

curl --location -g '{{baseUrl}}/v1/categories/{{market}}/{{language}}/'

**STATUSES**

**Overview**

This API enables you to track the processing status of your article requests across multiple markets. It provides two main ways to check statuses:

**Endpoints**

**1\. Batch Status Tracking (/v1/statuses/batch)**

Check the status of multiple article requests submitted in batches- Returns status information for all articles within specified batch IDs

**2\. Individual SKU Status Tracking (/v1/statuses/sku)**

Returns the latest processed status information for specific articles. Note that this endpoint provides eventual consistency - the status returned reflects the most recent processing state, there could be submitted changes that haven't been processed yet.

**POST List Statuses By Batch Ids**

{{baseUrl}}/v1/statuses/batch

**HEADERS**
|               |                  |
|---------------|------------------|
| x-merchant-id | string           |
| Content-Type  | application/json |
| Accept        | application/json |

**Body** raw (json)

**json**

{

"batch_ids": \[

"string",

"string"

\]

}

**Example Request - Successful response**

curl --location -g '{{baseUrl}}/v1/statuses/batch?status=ok&mocked_response=true' \\

\--header 'x-merchant-id: string' \\

\--header 'Accept: application/json' \\

\--data '{

"batch_ids": \[

"string",

"string"

\]

}'

**Example response - 200 OK**

{

"batches": \[

{

"id": "&lt;batch-id&gt;",

"statuses": \[

{

"correlation_id": "string",

"article_id": "string",

"sku": "string",

"action": "string",

"markets": \[

{

"market": "\*",

"status": "ok",

"error_code": null

},

{

"market": "\*",

"status": "failed",

"error_code": "permission_denied"

}

\]

},

{

"correlation_id": "string",

"article_id": "string",

"sku": "string",

"action": "string",

"markets": \[

{

"market": "\*",

"status": "pending",

"error_code": null

},

{

"market": "\*",

"status": "failed",

"error_code": "article_does_not_exist"

}

\]

}

\]

},

{

"id": "&lt;batch-id&gt;",

"statuses": \[

{

"correlation_id": "string",

"article_id": "string",

"sku": "string",

"action": "string",

"markets": \[

{

"market": "\*",

"status": "failed",

"error_code": "invalid_category"

},

{

"market": "\*",

"status": "ok",

"error_code": null

}

\]

},

{

"correlation_id": "string",

"article_id": "string",

"sku": "string",

"action": "string",

"markets": \[

{

"market": "\*",

"status": "failed",

"error_code": "sku_already_exists"

},

{

"market": "\*",

"status": "failed",

"error_code": "invalid_vat_rate"

}

\]

}

\]

}

\]

}

**Headers**

Content-Type

application/json

**POST List Statuses By Skus**

{{baseUrl}}/v1/statuses/sku

**HEADERS**
|               |                  |
|---------------|------------------|
| x-merchant-id | string           |
| Content-Type  | application/json |
| Accept        | application/json |

**Body**raw (json)

**json**

{

"skus": \[

"string",

"string"

\]

}

**Example Request - Successful response**

curl --location -g '{{baseUrl}}/v1/statuses/sku?status=ok&mocked_response=true' \\

\--header 'x-merchant-id: string' \\

\--header 'Accept: application/json' \\

\--data '{

"skus": \[

"string",

"string"

\]

}'

**Example response - 200 OK**

{

"statuses": \[

{

"correlation_id": "string",

"article_id": "string",

"sku": "string",

"action": "string",

"markets": \[

{

"market": "\*",

"status": "failed",

"error_code": "invalid_classification"

},

{

"market": "\*",

"status": "failed",

"error_code": "invalid_vat_rate"

}

\]

},

{

"correlation_id": "string",

"article_id": "string",

"sku": "string",

"action": "string",

"markets": \[

{

"market": "\*",

"status": "failed",

"error_code": "invalid_category"

},

{

"market": "\*",

"status": "failed",

"error_code": "sku_already_exists"

}

\]

}

\]

}

**Headers**

Content-Type

application/json