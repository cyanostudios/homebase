{
"openapi": "3.0.0",
"info": {
"title": "Booking Data Validation",
"description": "Booking Data Validation e.g. \n - Postal code validation. If it exist (nordics) or the pattern is correct (the rest of the world)\n - Customer number validation",
"version": "1.0.6.1"
},
"servers": [
{
"url": "https://atapi2.postnord.com/rest/shipment",
"description": "Sandbox server (uses test data)"
},
{
"url": "https://api2.postnord.com/rest/shipment",
"description": "Production server"
}
],
"paths": {
"/v1/validate/postalcode": {
"post": {
"tags": [
"Booking Data Validation"
],
"summary": "Validate Postal code",
"description": "Allows you to validate if the postalcode is valid for a specific county and serviceCode. For the Nordics if it exist and for the rest of the world that the pattern is correct.",
"operationId": "addItem",
"parameters": [
{
"name": "apikey",
"in": "query",
"description": "The unique consumer (client) identifier 32 characters",
"required": true,
"schema": {
"type": "string"
}
}
],
"requestBody": {
"description": "Contains the information for the request. No space, - or / should be used in the postalcode.",
"content": {
"application/json": {
"schema": {
"type": "array",
"items": {
"$ref": "#/components/schemas/postalCodeObject"
                }
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/postalCodeResponse"
}
}
}
}
},
"400": {
"$ref": "#/components/responses/400_BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/401_Unauthorized"
},
"403": {
"$ref": "#/components/responses/403_Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/404_NotFound"
},
"405": {
"$ref": "#/components/responses/405_MethodNotAllowed"
          },
          "429": {
            "$ref": "#/components/responses/429_TooManyRequests"
},
"499": {
"$ref": "#/components/responses/499_ClientClosedRequest"
          },
          "503": {
            "$ref": "#/components/responses/503_ServiceUnavailable"
},
"504": {
"$ref": "#/components/responses/504_GatewayTimeout"
          }
        }
      }
    },
    "/v1/validate/customernumber": {
      "get": {
        "tags": [
          "Booking Data Validation"
        ],
        "summary": "Validate Customer number",
        "description": "Allows you to validate if a customer number does exist or is correct.",
        "operationId": "validateCustomerGet",
        "parameters": [
          {
            "name": "apikey",
            "in": "query",
            "description": "The unique consumer (client) identifier 32 characters",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "customerNumber",
            "in": "query",
            "description": "Could either be SAP (8 digits) customer number or production customer number (10 digits)",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "countryCode",
            "in": "query",
            "description": "Country code (alpha-2 format), available values DK (Z11), SE (Z12), NO (Z13) and FI (Z14)",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "The request has succeeded"
          },
          "400": {
            "$ref": "#/components/responses/400_BadRequest"
},
"401": {
"$ref": "#/components/responses/401_Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/403_Forbidden"
},
"404": {
"$ref": "#/components/responses/404_NotFound"
          },
          "405": {
            "$ref": "#/components/responses/405_MethodNotAllowed"
},
"429": {
"$ref": "#/components/responses/429_TooManyRequests"
          },
          "499": {
            "$ref": "#/components/responses/499_ClientClosedRequest"
},
"503": {
"$ref": "#/components/responses/503_ServiceUnavailable"
          },
          "504": {
            "$ref": "#/components/responses/504_GatewayTimeout"
}
}
}
}
},
"components": {
"schemas": {
"postalCodeObject": {
"required": [
"countryCode",
"postalCode"
],
"type": "object",
"properties": {
"postalCode": {
"$ref": "#/components/schemas/postalCode"
          },
          "countryCode": {
            "$ref": "#/components/schemas/countryCode"
},
"basicServiceCode": {
"$ref": "#/components/schemas/basicServiceCode"
          }
        },
        "description": "Postal Code  Request"
      },
      "postalCodeResponse": {
        "required": [
          "countryCode",
          "postalCode"
        ],
        "type": "object",
        "properties": {
          "postalCode": {
            "$ref": "#/components/schemas/postalCode"
},
"postalCodeType": {
"type": "string",
"description": "Can be of the type NORMAL or BOXADMIN.",
"example": "NORMAL"
},
"validationResult": {
"type": "string",
"description": "Can be any of INVALID, VALID, INVALID_COMBINATION, INVALID_PATTERN, INVALID_DPD",
"example": "VALID"
},
"validForPackageTypeCode": {
"type": "array",
"items": {
"type": "string",
"description": "Can contain one or many types. The possible types are Parcels and Letters",
"example": "Parcels"
}
},
"city": {
"$ref": "#/components/schemas/city"
          },
          "countryCode": {
            "$ref": "#/components/schemas/countryCode"
},
"postalCodePattern": {
"type": "array",
"items": {
"$ref": "#/components/schemas/postalCodePattern"
}
},
"postalCodePatternDesc": {
"type": "string",
"description": "A=letter (A-Z), N=number (0-9), ?=Letter or Number",
"example": "A=letter (A-Z), N=number (0-9), ?=Letter or Number"
},
"textKey": {
"type": "string",
"description": "Can be used to have a front end localization of the text message to show",
"example": "textKey001"
},
"specialRule": {
"type": "string",
"description": "Used for countries that are not using postal codes",
"example": "For a country without a postal code set \"0000\" in the EDI to PostNord"
},
"subType": {
"type": "string",
"description": "Postal code sub type"
},
"subTypeDesc": {
"type": "string",
"description": "Postal code sub type description"
},
"functions": {
"type": "array",
"items": {
"type": "string",
"example": "ADMINISTRATIVT POSTNUMMER"
}
}
},
"description": "Postal Code Request"
},
"postalCode": {
"minLength": 1,
"type": "string",
"description": "The postal code for the address",
"example": "19162"
},
"countryCode": {
"maxLength": 2,
"minLength": 2,
"type": "string",
"description": "ISO 3166 country code of the item.",
"example": "SE"
},
"basicServiceCode": {
"maxLength": 10,
"minLength": 1,
"type": "string",
"description": "Identification of a product or service offered by TransportCompany or Forwarder",
"example": "19"
},
"city": {
"maxLength": 35,
"minLength": 1,
"type": "string",
"description": "The name of the city",
"example": "Sollentuna"
},
"postalCodePattern": {
"type": "string",
"description": "Defines the valid pattern of a postal code",
"example": "NNNNN"
}
},
"responses": {
"400_BadRequest": {
"description": "The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing)."
},
"401_Unauthorized": {
"description": "Authentication token is missing/invalid "
},
"403_Forbidden": {
"description": "The server understood the request but refuses to authorize it (e.g. API-key, access-token, JWT)"
},
"404_NotFound": {
"description": "The origin server did not find a current representation for the target resource or is not willing to disclose that one exists."
},
"405_MethodNotAllowed": {
"description": "The method received in the request-line is known by the origin server but not supported by the target resource."
},
"429_TooManyRequests": {
"description": "The user has sent too many requests in a given amount of time."
},
"499_ClientClosedRequest": {
"description": "The server does not support the functionality required to fulfill the request."
},
"503_ServiceUnavailable": {
"description": "The server is currently unable to handle the request due to a temporary overload or scheduled maintenance, which will likely be alleviated after some delay."
},
"504_GatewayTimeout": {
"description": "The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server it needed to access in order to complete the request."
}
}
}
}
