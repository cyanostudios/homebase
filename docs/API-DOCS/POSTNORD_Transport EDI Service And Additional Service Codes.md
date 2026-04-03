{
"swagger": "2.0",
"info": {
"description": "Transport EDI Service And Additional Service Codes",
"version": "2.0.0",
"title": "Transport EDI Service And Additional Service Codes"
},
"host": "api2.postnord.com",
"basePath": "/rest/shipment",
"schemes": [
"https"
],
"consumes": [
"application/json"
],
"produces": [
"application/json"
],
"paths": {
"/v3/edi/servicecodes": {
"get": {
"tags": [
"PostNord Service Codes (Deprecated)"
],
"summary": "List PostNord Basic Service Codes",
"description": "List PostNord Basic Service Codes",
"operationId": "getServicecodes",
"parameters": [
{
"name": "apikey",
"in": "query",
"description": "The unique consumer (client) identifier 32 characters",
"required": true,
"type": "string",
"x-data-threescale-name": "user_keys"
}
],
"responses": {
"200": {
"description": "Successful",
"schema": {
"$ref": "#/definitions/serviceCodesResponse"
            }
          },
          "400": {
            "description": "The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).",
            "schema": {
              "$ref": "#/definitions/errorResponse"
}
},
"401": {
"description": "Authentication token is missing/invalid ",
"schema": {
"$ref": "#/definitions/errorResponse"
            }
          },
          "403": {
            "description": "The server understood the request but refuses to authorize it (e.g. API-key, access-token, JWT)",
            "schema": {
              "$ref": "#/definitions/errorResponse"
}
},
"404": {
"description": "The origin server did not find a current representation for the target resource or is not willing to disclose that one exists.",
"schema": {
"$ref": "#/definitions/errorResponse"
            }
          },
          "405": {
            "description": "The method received in the request-line is known by the origin server but not supported by the target resource."
          },
          "429": {
            "description": "The user has sent too many requests in a given amount of time."
          },
          "499": {
            "description": "The server does not support the functionality required to fulfill the request."
          },
          "503": {
            "description": "The server is currently unable to handle the request due to a temporary overload or scheduled maintenance, which will likely be alleviated after some delay."
          },
          "504": {
            "description": "The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server it needed to access in order to complete the request."
          }
        }
      }
    },
    "/v3/edi/adnlservicecodes": {
      "get": {
        "tags": [
          "PostNord Service Codes (Deprecated)"
        ],
        "summary": "List PostNord Additional Service Codes",
        "description": "List PostNord Additional Service CodesCodes",
        "operationId": "getAdnlservicecodes",
        "parameters": [
          {
            "name": "apikey",
            "in": "query",
            "description": "The unique consumer (client) identifier 32 characters",
            "required": true,
            "type": "string",
            "x-data-threescale-name": "user_keys"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful",
            "schema": {
              "$ref": "#/definitions/adnlservicecodesResponse"
}
},
"400": {
"description": "The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).",
"schema": {
"$ref": "#/definitions/errorResponse"
            }
          },
          "401": {
            "description": "Authentication token is missing/invalid ",
            "schema": {
              "$ref": "#/definitions/errorResponse"
}
},
"403": {
"description": "The server understood the request but refuses to authorize it (e.g. API-key, access-token, JWT)",
"schema": {
"$ref": "#/definitions/errorResponse"
            }
          },
          "404": {
            "description": "The origin server did not find a current representation for the target resource or is not willing to disclose that one exists.",
            "schema": {
              "$ref": "#/definitions/errorResponse"
}
},
"405": {
"description": "The method received in the request-line is known by the origin server but not supported by the target resource."
},
"429": {
"description": "The user has sent too many requests in a given amount of time."
},
"499": {
"description": "The server does not support the functionality required to fulfill the request."
},
"503": {
"description": "The server is currently unable to handle the request due to a temporary overload or scheduled maintenance, which will likely be alleviated after some delay."
},
"504": {
"description": "The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server it needed to access in order to complete the request."
}
}
}
},
"/v3/edi/servicecodes/adnlservicecodes/combinations": {
"get": {
"tags": [
"PostNord Service Codes (Deprecated)"
],
"summary": "List valid PostNord Basic Service Codes and Additional Service Code combinations",
"description": "List valid PostNord Basic Service Codes and Additional Service Code combinations",
"operationId": "getadnlservicecodecombinations",
"parameters": [
{
"name": "apikey",
"in": "query",
"description": "The unique consumer (client) identifier 32 characters",
"required": true,
"type": "string",
"x-data-threescale-name": "user_keys"
}
],
"responses": {
"200": {
"description": "Successful",
"schema": {
"$ref": "#/definitions/adnlServiceCodeCombResponse"
            }
          },
          "400": {
            "description": "The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).",
            "schema": {
              "$ref": "#/definitions/errorResponse"
}
},
"401": {
"description": "Authentication token is missing/invalid ",
"schema": {
"$ref": "#/definitions/errorResponse"
            }
          },
          "403": {
            "description": "The server understood the request but refuses to authorize it (e.g. API-key, access-token, JWT)",
            "schema": {
              "$ref": "#/definitions/errorResponse"
}
},
"404": {
"description": "The origin server did not find a current representation for the target resource or is not willing to disclose that one exists.",
"schema": {
"$ref": "#/definitions/errorResponse"
            }
          },
          "405": {
            "description": "The method received in the request-line is known by the origin server but not supported by the target resource."
          },
          "429": {
            "description": "The user has sent too many requests in a given amount of time."
          },
          "499": {
            "description": "The server does not support the functionality required to fulfill the request."
          },
          "503": {
            "description": "The server is currently unable to handle the request due to a temporary overload or scheduled maintenance, which will likely be alleviated after some delay."
          },
          "504": {
            "description": "The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server it needed to access in order to complete the request."
          }
        }
      }
    },
    "/v1/sac/config/service/{serviceType}/list": {
      "get": {
        "tags": [
          "BasicService And AdditionalService -codes"
        ],
        "summary": "Get all service configuration",
        "description": "Get basic service code, additional service code or combination of basic and additional\nservice code configuration.\n",
        "operationId": "getAllServiceConfig",
        "parameters": [
          {
            "name": "apikey",
            "in": "query",
            "description": "The unique consumer (client) identifier 32 characters",
            "required": true,
            "type": "string",
            "x-data-threescale-name": "user_keys"
          },
          {
            "name": "serviceType",
            "in": "path",
            "description": "Service Type. Must be basicService or additionalService or basicAddonCombo",
            "required": true,
            "type": "string"
          },
          {
            "name": "issuerCountryCode",
            "in": "query",
            "description": "Issuer Country Code. Only 4 country codes are allowed. SE, NO, FI, DK",
            "required": false,
            "type": "string"
          },
          {
            "name": "serviceCode",
            "in": "query",
            "description": "Basic Service Code",
            "required": false,
            "type": "string"
          },
          {
            "name": "adnlServiceCode",
            "in": "query",
            "description": "Additional Service Code",
            "required": false,
            "type": "string"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful",
            "schema": {
              "$ref": "#/definitions/serviceConfigs"
}
},
"400": {
"description": "The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).",
"schema": {
"$ref": "#/definitions/errorResponse_2"
            }
          },
          "401": {
            "description": "Authentication token is missing/invalid ",
            "schema": {
              "$ref": "#/definitions/errorResponse_2"
}
},
"403": {
"description": "The server understood the request but refuses to authorize it (e.g. API-key, access-token, JWT)",
"schema": {
"$ref": "#/definitions/errorResponse_2"
            }
          },
          "404": {
            "description": "The origin server did not find a current representation for the target resource or is not willing to disclose that one exists.",
            "schema": {
              "$ref": "#/definitions/errorResponse_2"
}
},
"405": {
"description": "The method received in the request-line is known by the origin server but not supported by the target resource."
},
"429": {
"description": "The user has sent too many requests in a given amount of time."
},
"499": {
"description": "The server does not support the functionality required to fulfill the request."
},
"503": {
"description": "The server is currently unable to handle the request due to a temporary overload or scheduled maintenance, which will likely be alleviated after some delay."
},
"504": {
"description": "The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server it needed to access in order to complete the request."
}
}
}
}
},
"definitions": {
"serviceConfigs": {
"type": "array",
"description": "Service configs",
"items": {
"$ref": "#/definitions/serviceConfig"
      }
    },
    "serviceConfig": {
      "type": "object",
      "properties": {
        "issuerCode": {
          "$ref": "#/definitions/issuerCode_2"
},
"issuerCountryCode": {
"$ref": "#/definitions/countryCode"
        },
        "issuerCountry": {
          "type": "string",
          "example": "Denmark",
          "description": "Country name"
        },
        "serviceCodeDetails": {
          "type": "array",
          "description": "Service configuration details",
          "items": {
            "$ref": "#/definitions/serviceConfigDetails"
}
}
},
"description": "Service config"
},
"serviceConfigDetails": {
"properties": {
"serviceCode": {
"$ref": "#/definitions/basicServiceCode"
        },
        "serviceName": {
          "type": "string",
          "example": "MyPack Home",
          "description": "Name of the service"
        },
        "defaultPackageType": {
          "type": "string"
        },
        "validFrom": {
          "type": "string",
          "example": "2017-12-01",
          "description": "The date from which the service is valid"
        },
        "validTo": {
          "type": "string",
          "example": "2017-12-01",
          "description": "The date until the service is valid"
        },
        "allowedConsigneeCountry": {
          "$ref": "#/definitions/countryCode"
},
"allowedConsignorCountry": {
"type": "string",
"example": "ALL"
},
"shipmentMaxWeight": {
"type": "string",
"example": "0"
},
"maximumInsuranceAmount": {
"type": "string",
"example": "0"
},
"isShipmentService": {
"type": "boolean"
},
"isPhoneNumberMandatory": {
"type": "boolean"
}
},
"description": "Service configuration details"
},
"adnlservicecodesResponse": {
"type": "object",
"properties": {
"status": {
"$ref": "#/definitions/status"
        },
        "data": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/adnlServiceCodeData"
}
}
}
},
"serviceCodesResponse": {
"type": "object",
"properties": {
"status": {
"$ref": "#/definitions/status"
        },
        "data": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/serviceCodesData"
}
}
}
},
"adnlServiceCodeCombResponse": {
"type": "object",
"properties": {
"status": {
"$ref": "#/definitions/status"
        },
        "data": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/adnlServiceCodeCombData"
}
}
}
},
"serviceCodesData": {
"type": "object",
"properties": {
"issuerCountry": {
"$ref": "#/definitions/issuerCountry"
        },
        "issuerCountryCode": {
          "$ref": "#/definitions/issuerCountryCode"
},
"issuerCode": {
"$ref": "#/definitions/issuerCode"
        },
        "serviceCodeDetails": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/serviceCodeDetails"
}
}
}
},
"adnlServiceCodeData": {
"type": "object",
"properties": {
"issuerCountry": {
"$ref": "#/definitions/issuerCountry"
        },
        "issuerCountryCode": {
          "$ref": "#/definitions/issuerCountryCode"
},
"issuerCode": {
"$ref": "#/definitions/issuerCode"
        },
        "adnlServiceNordicCdDetails": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/adnlServiceNordicCdDetails"
}
}
}
},
"adnlServiceCodeCombData": {
"type": "object",
"properties": {
"issuerCountry": {
"$ref": "#/definitions/issuerCountry"
        },
        "issuerCountryCode": {
          "$ref": "#/definitions/issuerCountryCode"
},
"issuerCode": {
"$ref": "#/definitions/issuerCode"
        },
        "adnlServiceCodeCombDetails": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/adnlServiceCodeCombDetails"
}
}
}
},
"adnlServiceNordicCdDetails": {
"type": "object",
"properties": {
"adnlServiceCode": {
"$ref": "#/definitions/adnlServiceCode"
        },
        "adnlServiceName": {
          "$ref": "#/definitions/adnlServiceName"
},
"validFrom": {
"$ref": "#/definitions/validFrom"
        },
        "validTo": {
          "$ref": "#/definitions/validTo"
},
"adnlServiceType": {
"$ref": "#/definitions/adnlServiceType"
        },
        "refLocalCode": {
          "$ref": "#/definitions/refLocalCode"
},
"refLocalName": {
"$ref": "#/definitions/refLocalName"
        }
      }
    },
    "serviceCodeDetails": {
      "type": "object",
      "properties": {
        "serviceCode": {
          "$ref": "#/definitions/serviceCode"
},
"serviceName": {
"$ref": "#/definitions/serviceName"
        },
        "defaultPackageType": {
          "$ref": "#/definitions/defaultPackageType"
},
"validFrom": {
"$ref": "#/definitions/validFrom"
        },
        "validTo": {
          "$ref": "#/definitions/validTo"
},
"allowedConsigneeCountry": {
"$ref": "#/definitions/allowedConsigneeCountry"
        },
        "allowedConsignorCountry": {
          "$ref": "#/definitions/allowedConsignorCountry"
},
"shipmentMaxWeight": {
"$ref": "#/definitions/shipmentMaxWeight"
        },
        "maximumInsuranceAmount": {
          "$ref": "#/definitions/maximumInsuranceAmount"
},
"isShipmentService": {
"$ref": "#/definitions/isShipmentService"
        },
        "isPhoneNumberMandatory": {
          "$ref": "#/definitions/isPhoneNumberMandatory"
}
}
},
"adnlServiceCodeCombDetails": {
"type": "object",
"properties": {
"serviceCode": {
"$ref": "#/definitions/serviceCode"
        },
        "serviceName": {
          "$ref": "#/definitions/serviceName"
},
"adnlServiceCode": {
"$ref": "#/definitions/adnlServiceCode"
        },
        "adnlServiceName": {
          "$ref": "#/definitions/adnlServiceName"
},
"validFrom": {
"$ref": "#/definitions/validFrom"
        },
        "validTo": {
          "$ref": "#/definitions/validTo"
},
"allowedConsigneeCountry": {
"$ref": "#/definitions/allowedConsigneeCountry"
        },
        "allowedConsignorCountry": {
          "$ref": "#/definitions/allowedConsignorCountry"
},
"mandatory": {
"$ref": "#/definitions/mandatory"
        }
      }
    },
    "adnlServiceType": {
      "type": "string",
      "description": "Type of additional service code",
      "example": "LOCAL"
    },
    "refLocalCode": {
      "type": "string",
      "description": "The refering local code",
      "example": "ZIN"
    },
    "refLocalName": {
      "type": "string",
      "description": "The refering local name",
      "example": "Supplementary cargo insurance"
    },
    "defaultPackageType": {
      "type": "string",
      "description": "Type of package or packaging material, (PC=parcel, PE=pallet_eur, AF=pallet_half, OA=pallet_quarter, OF=pallet_special, CW=cage roll,  BX=box, EN=envelope) refers to UN/ECE Rec. No. 21",
      "example": "PC"
    },
    "shipmentMaxWeight": {
      "type": "string",
      "description": "The maximum shipment weight",
      "example": "0"
    },
    "maximumInsuranceAmount": {
      "type": "string",
      "description": "The maximum insurance amount",
      "example": "0"
    },
    "isShipmentService": {
      "type": "boolean",
      "description": "Requires a shipment id",
      "example": false
    },
    "isPhoneNumberMandatory": {
      "type": "boolean",
      "description": "Phone numbers is mandatory",
      "example": false
    },
    "status": {
      "type": "string",
      "description": "Defines if it is active = 0  or inactive = 0",
      "example": "0"
    },
    "issuerCountry": {
      "type": "string",
      "description": "Issuer country name",
      "example": "NORWAY"
    },
    "issuerCountryCode": {
      "type": "string",
      "description": "Issuer 2-letter country code",
      "example": "NO"
    },
    "issuerCode": {
      "type": "string",
      "description": "The customer number country agreement is with; (Z11=PostNord Denmark, Z12=PostNord Sweden, Z13=PostNord Norway, Z14=PostNord Finland)",
      "example": "Z13"
    },
    "serviceCode": {
      "type": "string",
      "description": "Identification of a product or service offered by TransportCompany or Forwarder",
      "example": "83"
    },
    "serviceName": {
      "type": "string",
      "description": "Name of a product or service offered by TransportCompany or Forwarder",
      "example": "Groupage"
    },
    "adnlServiceCode": {
      "type": "string",
      "description": "Additional service code linked to Basic Service Code",
      "example": "A5"
    },
    "adnlServiceName": {
      "type": "string",
      "description": "Name of additional service code linked to Basic Service Code",
      "example": "Insurance"
    },
    "validFrom": {
      "type": "string",
      "description": "Valid from date",
      "example": "2017-12-01"
    },
    "validTo": {
      "type": "string",
      "description": "Valid to date",
      "example": "2099-12-01"
    },
    "allowedConsigneeCountry": {
      "type": "string",
      "description": "Allowed combination for the 2-letter consignee country code. ALL means all countries",
      "example": "NO"
    },
    "allowedConsignorCountry": {
      "type": "string",
      "description": "Allowed combination for the 2-letter consignor country code. ALL means all countries",
      "example": "ALL"
    },
    "mandatory": {
      "type": "boolean",
      "description": "Mandatory combination",
      "example": false
    },
    "errorResponse": {
      "type": "object",
      "required": [
        "message"
      ],
      "properties": {
        "compositeFault": {
          "$ref": "#/definitions/compositeFault"
},
"message": {
"type": "string",
"example": "Query parameter missing",
"description": "High level error message."
}
},
"description": "PostNord standard error response message"
},
"compositeFault": {
"type": "object",
"properties": {
"faults": {
"type": "array",
"uniqueItems": true,
"items": {
"$ref": "#/definitions/fault"
          }
        }
      },
      "description": "The composite fault object containing an array of fault objects"
    },
    "fault": {
      "type": "object",
      "required": [
        "explanationText"
      ],
      "properties": {
        "paramValues": {
          "type": "array",
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/paramValue"
}
},
"explanationText": {
"type": "string",
"example": "Missing parameter"
},
"faultCode": {
"type": "string",
"example": "API-005"
}
},
"description": "Fault object with the associated code and explanation text"
},
"paramValue": {
"type": "object",
"properties": {
"param": {
"type": "string"
},
"value": {
"type": "string"
}
},
"description": "A parameter value pair is a set of two linked data items"
},
"errorResponse_2": {
"type": "object",
"required": [
"message"
],
"properties": {
"compositeFault": {
"$ref": "#/definitions/compositeFault_2"
        },
        "message": {
          "type": "string",
          "example": "Query parameter missing",
          "description": "High level error message."
        }
      },
      "description": "PostNord standard error response message"
    },
    "compositeFault_2": {
      "type": "object",
      "properties": {
        "faults": {
          "type": "array",
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/fault_2"
}
}
},
"description": "The composite fault object containing an array of fault objects"
},
"fault_2": {
"type": "object",
"required": [
"explanationText"
],
"properties": {
"paramValues": {
"type": "array",
"uniqueItems": true,
"items": {
"$ref": "#/definitions/paramValue_2"
}
},
"explanationText": {
"type": "string",
"example": "Missing parameter"
},
"faultCode": {
"type": "string",
"example": "API-005"
}
},
"description": "Fault object with the associated code and explanation text"
},
"paramValue_2": {
"type": "object",
"properties": {
"param": {
"type": "string"
},
"value": {
"type": "string"
}
},
"description": "A parameter value pair is a set of two linked data items"
},
"issuerCode_2": {
"type": "string",
"minLength": 1,
"maxLength": 3,
"description": "The customer number country agreement is with; (Z11=PostNord Denmark, Z12=PostNord Sweden, Z13=PostNord Norway, Z14=PostNord Finland)",
"example": "Z11"
},
"countryCode": {
"type": "string",
"minLength": 2,
"maxLength": 2,
"description": "ISO 3166 country code of the item.",
"example": "SE"
},
"basicServiceCode": {
"type": "string",
"minLength": 1,
"maxLength": 10,
"description": "Identification of a product or service offered by TransportCompany or Forwarder",
"example": "19"
}
}
}
