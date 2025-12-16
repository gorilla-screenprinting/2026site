# S&S API Field Reference (Styles & Products)

## How to refresh these lists

```
# Styles (replace 39 with a styleID from your lookup)
curl -u "32140:c2284f4d-9462-4b43-a995-1cff3bfd2e42" \
  "https://api.ssactivewear.com/V2/styles?styleid=39&limit=1&mediatype=json" \
  | jq '.[0] | keys'

# Products (same styleID)
curl -u "32140:c2284f4d-9462-4b43-a995-1cff3bfd2e42" \
  "https://api.ssactivewear.com/V2/products?styleid=39&limit=1&mediatype=json" \
  | jq '.[0] | keys'
```

## Styles keys (example: styleID 39)

baseCategory,
boxRequired,
brandImage,
brandName,
catalogPageNumber,
categories,
companionGroup,
comparableGroup,
description,
newStyle,
noeRetailing,
partNumber,
prop65Chemicals,
styleID,
styleImage,
styleName,
sustainableStyle,
title,
uniqueStyleName

## Products keys (per color/size)

baseCategoryID,
brandID,
brandName,
caseHeight,
caseLength,
casePrice,
caseQty,
caseWeight,
caseWidth,
color1,
color2,
colorBackImage,
colorCode,
colorDirectSideImage,
colorFamily,
colorFamilyID,
colorFrontImage,
colorGroup,
colorGroupName,
colorName,
colorOnModelBackImage,
colorOnModelFrontImage,
colorOnModelSideImage,
colorPriceCodeName,
colorSideImage,
colorSwatchImage,
colorSwatchTextColor,
countryOfOrigin,
customerPrice,
dozenPrice,
gtin,
mapPrice,
noeRetailing,
piecePrice,
polyPackQty,
qty,
saleExpiration,
salePrice,
sizeCode,
sizeName,
sizeOrder,
sizePriceCodeName,
sku,
skuID_Master,
styleID,
styleName,
unitWeight,
warehouses,
yourSku
