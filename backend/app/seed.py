"""Idempotent FMCG seed: 6 top categories, ~50 subcategories, ~50 realistic
FMCG products with brand, pack info, veg/non-veg, nutrition, FSSAI/HSN, etc.

Categories follow the V-Mart Retail Ltd. FMCG architecture:
  1. Food & Beverages
  2. Staples & Cooking Essentials
  3. Personal Care
  4. Home Care & Cleaning
  5. Health & Wellness
  6. Household & General Merchandise
"""
from __future__ import annotations

import logging
import os

from .models import new_id, now_iso
from .security import hash_password

log = logging.getLogger("vfast.seed")

# ---------------- Categories ---------------- #
# Each category has a `slug`, `name`, `tint`, `image`, plus a list of subcategories.
CATEGORIES = [
    {
        "slug": "food-beverages", "name": "Food & Beverages", "tint": "#ECFDF5",
        "image": "https://images.pexels.com/photos/12765459/pexels-photo-12765459.jpeg",
        "subcategories": [
            ("fruits-veg", "Fresh Fruits & Vegetables"),
            ("dairy-eggs", "Dairy & Eggs"),
            ("bread-bakery", "Bread & Bakery"),
            ("beverages", "Beverages"),
            ("breakfast-cereals", "Breakfast & Cereals"),
            ("snacks-namkeen", "Snacks & Namkeen"),
            ("biscuits-cookies", "Biscuits & Cookies"),
            ("chocolates-sweets", "Chocolates & Sweets"),
            ("frozen-foods", "Frozen Foods"),
            ("ready-to-cook", "Ready-to-Cook & Instant Meals"),
            ("packaged-foods", "Packaged Foods"),
            ("baby-food", "Baby Food & Formula"),
        ],
    },
    {
        "slug": "staples", "name": "Staples & Cooking Essentials", "tint": "#FEFCE8",
        "image": "https://images.pexels.com/photos/4198021/pexels-photo-4198021.jpeg",
        "subcategories": [
            ("atta-flour", "Atta, Flour & Sooji"),
            ("rice", "Rice & Rice Products"),
            ("dal-pulses", "Dal & Pulses"),
            ("oil-ghee", "Cooking Oil & Ghee"),
            ("salt-sugar", "Salt, Sugar & Jaggery"),
            ("spices-masala", "Spices & Masala"),
            ("dry-fruits", "Dry Fruits & Nuts"),
            ("pickles-sauces", "Pickles, Sauces & Condiments"),
            ("noodles-pasta", "Noodles, Pasta & Vermicelli"),
        ],
    },
    {
        "slug": "personal-care", "name": "Personal Care", "tint": "#F0FDF4",
        "image": "https://images.unsplash.com/photo-1589060040843-7a31813e6fb0",
        "subcategories": [
            ("hair-care", "Hair Care"),
            ("skin-care", "Skin Care"),
            ("bath-body", "Bath & Body"),
            ("oral-care", "Oral Care"),
            ("mens-grooming", "Men's Grooming"),
            ("womens-hygiene", "Women's Hygiene"),
            ("deodorants", "Deodorants & Perfumes"),
            ("baby-care", "Baby Care"),
        ],
    },
    {
        "slug": "home-care", "name": "Home Care & Cleaning", "tint": "#EFF6FF",
        "image": "https://images.pexels.com/photos/4239013/pexels-photo-4239013.jpeg",
        "subcategories": [
            ("dishwash", "Dishwash"),
            ("laundry", "Laundry"),
            ("floor-cleaners", "Floor & Surface Cleaners"),
            ("toilet-cleaners", "Toilet & Bathroom Cleaners"),
            ("air-fresheners", "Air Fresheners & Repellents"),
            ("garbage-wraps", "Garbage Bags & Cling Wraps"),
            ("pooja-needs", "Pooja Needs"),
        ],
    },
    {
        "slug": "health-wellness", "name": "Health & Wellness", "tint": "#FFF1F2",
        "image": "https://images.pexels.com/photos/3737599/pexels-photo-3737599.jpeg",
        "subcategories": [
            ("otc-firstaid", "OTC Medicines & First Aid"),
            ("vitamins-supplements", "Vitamins & Supplements"),
            ("protein-fitness", "Protein & Fitness"),
            ("feminine-hygiene", "Feminine Hygiene"),
            ("adult-diapers", "Adult Diapers & Incontinence"),
            ("sanitisers", "Sanitisers & Disinfectants"),
            ("masks-gloves", "Masks & Gloves"),
        ],
    },
    {
        "slug": "household-gm", "name": "Household & General Merchandise", "tint": "#F5F3FF",
        "image": "https://images.pexels.com/photos/4226876/pexels-photo-4226876.jpeg",
        "subcategories": [
            ("kitchen-storage", "Kitchen Storage & Containers"),
            ("foil-zip-locks", "Aluminium Foil, Cling Wrap & Zip Locks"),
            ("paper-products", "Paper Products"),
            ("stationery", "Stationery & Office Supplies"),
            ("batteries-electricals", "Batteries & Electricals"),
            ("pet-care", "Pet Care Essentials"),
            ("candles-agarbatti", "Candles & Agarbatti"),
        ],
    },
]


def _p(slug, name, brand, cat, sub, image, price, mrp, pack_size, unit_value, unit, veg="veg",
       stock=80, eta=12, hsn="2106", fssai=None, country="India", storage="ambient",
       allergens=None, shelf_life_days=None, nutrition=None, desc=None):
    return {
        "id": new_id(),
        "slug": slug,
        "name": name,
        "brand": brand,
        "category_slug": cat,
        "subcategory_slug": sub,
        "image": image,
        "images": [image],
        "price": float(price),
        "mrp": float(mrp),
        "pack_size": pack_size,         # display string e.g. "1 L"
        "unit_value": unit_value,       # numeric value
        "unit": unit,                   # "g" | "ml" | "kg" | "L" | "pc"
        "veg_type": veg,                # "veg" | "nonveg" | "vegan" | "na"
        "stock": stock,
        "eta_minutes": eta,
        "in_stock": stock > 0,
        "hsn_code": hsn,
        "fssai_no": fssai,
        "country_of_origin": country,
        "storage": storage,             # ambient | refrigerated | frozen
        "allergens": allergens or [],
        "shelf_life_days": shelf_life_days,
        "nutrition_per_100": nutrition,  # dict or None
        "express_eligible": eta <= 15,
        "description": desc or f"{brand} {name} — quality essential delivered fresh by VFast.",
        "created_at": now_iso(),
    }


# Realistic Indian FMCG demo products
PRODUCTS = [
    # ----- Food & Beverages ----- #
    _p("amul-taaza-milk-1l", "Amul Taaza Toned Milk", "Amul", "food-beverages", "dairy-eggs",
       "https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg",
       68, 70, "1 L", 1000, "ml", veg="veg", stock=120, eta=10, hsn="0401",
       fssai="10012011000123", storage="refrigerated", shelf_life_days=2,
       nutrition={"calories": 58, "protein": 3.0, "carbs": 4.7, "fat": 3.0, "sugar": 4.7, "sodium": 36},
       allergens=["milk"]),
    _p("amul-butter-100g", "Amul Salted Butter", "Amul", "food-beverages", "dairy-eggs",
       "https://images.pexels.com/photos/479643/pexels-photo-479643.jpeg",
       58, 62, "100 g", 100, "g", veg="veg", stock=60, eta=12, hsn="0405",
       fssai="10012011000124", storage="refrigerated", shelf_life_days=90,
       nutrition={"calories": 717, "protein": 0.8, "carbs": 0.1, "fat": 81.0, "sugar": 0.1, "sodium": 750},
       allergens=["milk"]),
    _p("paneer-200g", "Mother Dairy Fresh Paneer", "Mother Dairy", "food-beverages", "dairy-eggs",
       "https://images.pexels.com/photos/4198021/pexels-photo-4198021.jpeg",
       85, 95, "200 g", 200, "g", veg="veg", stock=40, eta=12, storage="refrigerated", shelf_life_days=5,
       allergens=["milk"]),
    _p("eggs-6pc", "Farm Fresh Eggs", "Suguna", "food-beverages", "dairy-eggs",
       "https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg",
       55, 65, "6 pc", 6, "pc", veg="nonveg", stock=70, eta=12, storage="refrigerated"),
    _p("brown-bread", "Britannia Brown Bread", "Britannia", "food-beverages", "bread-bakery",
       "https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg",
       45, 55, "400 g", 400, "g", veg="veg", stock=50, eta=12, hsn="1905",
       fssai="10013022000456", shelf_life_days=4, allergens=["wheat", "gluten"]),
    _p("tomatoes-500g", "Farm Fresh Tomatoes", "VFast Fresh", "food-beverages", "fruits-veg",
       "https://images.pexels.com/photos/12765459/pexels-photo-12765459.jpeg",
       45, 60, "500 g", 500, "g", veg="veg", stock=100, eta=10, hsn="0702",
       storage="refrigerated", shelf_life_days=5),
    _p("onions-1kg", "Farm Fresh Onions", "VFast Fresh", "food-beverages", "fruits-veg",
       "https://images.pexels.com/photos/9705821/pexels-photo-9705821.jpeg",
       35, 50, "1 kg", 1, "kg", veg="veg", stock=200, eta=10),
    _p("bananas-6pc", "Robusta Bananas", "VFast Fresh", "food-beverages", "fruits-veg",
       "https://images.pexels.com/photos/61127/pexels-photo-61127.jpeg",
       40, 55, "6 pc", 6, "pc", veg="veg", stock=80, eta=10),
    _p("apples-1kg", "Shimla Apples", "VFast Fresh", "food-beverages", "fruits-veg",
       "https://images.pexels.com/photos/206959/pexels-photo-206959.jpeg",
       180, 220, "1 kg", 1, "kg", veg="veg", stock=45, eta=10),
    _p("orange-juice", "Real Orange Juice", "Dabur Real", "food-beverages", "beverages",
       "https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg",
       99, 120, "1 L", 1000, "ml", veg="veg", stock=70, hsn="2009",
       fssai="10014011000789", nutrition={"calories": 47, "protein": 0.5, "carbs": 11.0, "fat": 0.0, "sugar": 10.0, "sodium": 1}),
    _p("cola-can", "Coca-Cola Can", "Coca-Cola", "food-beverages", "beverages",
       "https://images.unsplash.com/photo-1592892111425-15e04305f961",
       40, 40, "330 ml", 330, "ml", veg="veg", stock=100, hsn="2202"),
    _p("water-1l", "Bisleri Mineral Water", "Bisleri", "food-beverages", "beverages",
       "https://images.pexels.com/photos/327090/pexels-photo-327090.jpeg",
       20, 25, "1 L", 1000, "ml", veg="veg", stock=200, hsn="2201"),
    _p("maggi-70g", "Maggi 2-Minute Noodles", "Nestle Maggi", "food-beverages", "ready-to-cook",
       "https://images.pexels.com/photos/4518663/pexels-photo-4518663.jpeg",
       14, 14, "70 g", 70, "g", veg="veg", stock=300, hsn="1902",
       fssai="10012021000111", allergens=["wheat", "soy"],
       nutrition={"calories": 305, "protein": 7.6, "carbs": 44.0, "fat": 11.0, "sugar": 1.0, "sodium": 1280}),
    _p("maggi-4pack", "Maggi Noodles Family Pack", "Nestle Maggi", "food-beverages", "ready-to-cook",
       "https://images.pexels.com/photos/4518663/pexels-photo-4518663.jpeg",
       48, 56, "4 x 70 g", 280, "g", veg="veg", stock=150),
    _p("lays-classic-26g", "Lay's Classic Salted", "Lay's", "food-beverages", "snacks-namkeen",
       "https://images.pexels.com/photos/13060679/pexels-photo-13060679.jpeg",
       20, 20, "26 g", 26, "g", veg="veg", stock=250, hsn="1905"),
    _p("haldirams-bhujia-200g", "Haldiram's Aloo Bhujia", "Haldiram's", "food-beverages", "snacks-namkeen",
       "https://images.pexels.com/photos/5550317/pexels-photo-5550317.jpeg",
       62, 75, "200 g", 200, "g", veg="veg", stock=120, hsn="2106",
       fssai="10012021000222", allergens=["peanut"]),
    _p("parle-g-100g", "Parle-G Glucose Biscuits", "Parle", "food-beverages", "biscuits-cookies",
       "https://images.pexels.com/photos/230325/pexels-photo-230325.jpeg",
       12, 12, "100 g", 100, "g", veg="veg", stock=400, hsn="1905",
       allergens=["wheat", "gluten"]),
    _p("britannia-marie-250g", "Britannia Marie Gold", "Britannia", "food-beverages", "biscuits-cookies",
       "https://images.pexels.com/photos/230325/pexels-photo-230325.jpeg",
       40, 45, "250 g", 250, "g", veg="veg", stock=180),
    _p("kitkat-4f", "Nestle KitKat 4-Finger", "Nestle KitKat", "food-beverages", "chocolates-sweets",
       "https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg",
       40, 50, "37.3 g", 37, "g", veg="veg", stock=150, hsn="1806",
       allergens=["milk", "soy"]),
    _p("dabur-honey-250g", "Dabur Honey", "Dabur", "food-beverages", "packaged-foods",
       "https://images.pexels.com/photos/33260/honey-sweet-syrup-organic.jpg",
       175, 200, "250 g", 250, "g", veg="veg", stock=60, hsn="0409",
       fssai="10014011000345"),
    _p("cerelac-stage1", "Nestle Cerelac Wheat Stage 1", "Nestle Cerelac", "food-beverages", "baby-food",
       "https://images.pexels.com/photos/3984738/pexels-photo-3984738.jpeg",
       260, 295, "300 g", 300, "g", veg="veg", stock=40, hsn="1901",
       allergens=["wheat", "milk"]),

    # ----- Staples ----- #
    _p("aashirvaad-atta-5kg", "Aashirvaad Whole Wheat Atta", "Aashirvaad", "staples", "atta-flour",
       "https://images.pexels.com/photos/4198015/pexels-photo-4198015.jpeg",
       275, 320, "5 kg", 5, "kg", veg="veg", stock=80, hsn="1101",
       fssai="10013011000567", allergens=["wheat", "gluten"]),
    _p("daawat-basmati-1kg", "Daawat Rozana Basmati Rice", "Daawat", "staples", "rice",
       "https://images.pexels.com/photos/461428/pexels-photo-461428.jpeg",
       145, 170, "1 kg", 1, "kg", veg="veg", stock=100, hsn="1006"),
    _p("toor-dal-1kg", "Tata Sampann Toor Dal", "Tata Sampann", "staples", "dal-pulses",
       "https://images.pexels.com/photos/4198718/pexels-photo-4198718.jpeg",
       169, 190, "1 kg", 1, "kg", veg="veg", stock=90, hsn="0713"),
    _p("fortune-oil-1l", "Fortune Sunflower Oil", "Fortune", "staples", "oil-ghee",
       "https://images.pexels.com/photos/33783/olive-oil-salad-dressing-cooking-olive.jpg",
       159, 185, "1 L", 1000, "ml", veg="veg", stock=120, hsn="1512"),
    _p("amul-ghee-500ml", "Amul Pure Cow Ghee", "Amul", "staples", "oil-ghee",
       "https://images.pexels.com/photos/4198718/pexels-photo-4198718.jpeg",
       320, 360, "500 ml", 500, "ml", veg="veg", stock=50, hsn="0405",
       allergens=["milk"]),
    _p("tata-salt-1kg", "Tata Salt Iodised", "Tata", "staples", "salt-sugar",
       "https://images.pexels.com/photos/678414/pexels-photo-678414.jpeg",
       30, 30, "1 kg", 1, "kg", veg="veg", stock=200, hsn="2501"),
    _p("sugar-1kg", "Madhur Pure Sugar", "Madhur", "staples", "salt-sugar",
       "https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg",
       48, 55, "1 kg", 1, "kg", veg="veg", stock=180, hsn="1701"),
    _p("turmeric-100g", "MDH Haldi Powder", "MDH", "staples", "spices-masala",
       "https://images.pexels.com/photos/4198018/pexels-photo-4198018.jpeg",
       58, 70, "100 g", 100, "g", veg="veg", stock=90, hsn="0910"),
    _p("garam-masala-100g", "Everest Garam Masala", "Everest", "staples", "spices-masala",
       "https://images.pexels.com/photos/4198021/pexels-photo-4198021.jpeg",
       95, 110, "100 g", 100, "g", veg="veg", stock=80),
    _p("almonds-200g", "Happilo Premium Almonds", "Happilo", "staples", "dry-fruits",
       "https://images.pexels.com/photos/1295572/pexels-photo-1295572.jpeg",
       349, 450, "200 g", 200, "g", veg="vegan", stock=60, hsn="0802",
       allergens=["tree nut"]),
    _p("kissan-tomato-ketchup", "Kissan Tomato Ketchup", "Kissan", "staples", "pickles-sauces",
       "https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg",
       105, 120, "415 g", 415, "g", veg="veg", stock=110, hsn="2103"),

    # ----- Personal Care ----- #
    _p("dove-shampoo-180ml", "Dove Intense Repair Shampoo", "Dove", "personal-care", "hair-care",
       "https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg",
       175, 215, "180 ml", 180, "ml", veg="na", stock=70, hsn="3305"),
    _p("clinic-plus-shampoo", "Clinic Plus Strong & Long", "Clinic Plus", "personal-care", "hair-care",
       "https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg",
       115, 130, "175 ml", 175, "ml", veg="na", stock=120),
    _p("nivea-bodylotion-200ml", "Nivea Soft Light Moisturizer", "Nivea", "personal-care", "skin-care",
       "https://images.unsplash.com/photo-1696881694567-cd1a97958fc8",
       189, 230, "200 ml", 200, "ml", veg="na", stock=70, hsn="3304"),
    _p("dettol-handwash-200ml", "Dettol Original Handwash", "Dettol", "personal-care", "bath-body",
       "https://images.pexels.com/photos/4239013/pexels-photo-4239013.jpeg",
       89, 110, "200 ml", 200, "ml", veg="na", stock=150, hsn="3401"),
    _p("dove-soap-set", "Dove Cream Beauty Bathing Bar (3-pack)", "Dove", "personal-care", "bath-body",
       "https://images.unsplash.com/photo-1696881694567-cd1a97958fc8",
       180, 225, "3 x 100 g", 300, "g", veg="na", stock=90),
    _p("colgate-strong-100g", "Colgate Strong Teeth", "Colgate", "personal-care", "oral-care",
       "https://images.pexels.com/photos/3737599/pexels-photo-3737599.jpeg",
       72, 85, "100 g", 100, "g", veg="na", stock=160, hsn="3306"),
    _p("oral-b-brush", "Oral-B Pro Health Toothbrush", "Oral-B", "personal-care", "oral-care",
       "https://images.pexels.com/photos/3737599/pexels-photo-3737599.jpeg",
       45, 60, "1 pc", 1, "pc", veg="na", stock=200),
    _p("gillette-mach3", "Gillette Mach3 Razor", "Gillette", "personal-care", "mens-grooming",
       "https://images.pexels.com/photos/2076932/pexels-photo-2076932.jpeg",
       260, 320, "1 pc", 1, "pc", veg="na", stock=70),
    _p("whisper-ultra-15", "Whisper Ultra Clean XL (15 pads)", "Whisper", "personal-care", "womens-hygiene",
       "https://images.pexels.com/photos/4239013/pexels-photo-4239013.jpeg",
       199, 240, "15 pc", 15, "pc", veg="na", stock=90),
    _p("axe-deo-150ml", "Axe Signature Deodorant", "Axe", "personal-care", "deodorants",
       "https://images.pexels.com/photos/3737599/pexels-photo-3737599.jpeg",
       210, 260, "150 ml", 150, "ml", veg="na", stock=80, hsn="3307"),
    _p("pampers-diapers-m", "Pampers All-Round Protection M (24 pc)", "Pampers", "personal-care", "baby-care",
       "https://images.pexels.com/photos/3875212/pexels-photo-3875212.jpeg",
       299, 399, "24 pc", 24, "pc", veg="na", stock=60),

    # ----- Home Care ----- #
    _p("vim-bar-3pc", "Vim Dishwash Bar (3 x 130g)", "Vim", "home-care", "dishwash",
       "https://images.pexels.com/photos/4239013/pexels-photo-4239013.jpeg",
       45, 60, "3 x 130 g", 390, "g", veg="na", stock=180, hsn="3401"),
    _p("surf-excel-easywash-500g", "Surf Excel Easy Wash Detergent", "Surf Excel", "home-care", "laundry",
       "https://images.pexels.com/photos/5202924/pexels-photo-5202924.jpeg",
       115, 130, "500 g", 500, "g", veg="na", stock=140, hsn="3402"),
    _p("ariel-matic-1kg", "Ariel Matic Top Load Detergent", "Ariel", "home-care", "laundry",
       "https://images.pexels.com/photos/5202924/pexels-photo-5202924.jpeg",
       310, 360, "1 kg", 1, "kg", veg="na", stock=70),
    _p("lizol-1l", "Lizol Citrus Floor Cleaner", "Lizol", "home-care", "floor-cleaners",
       "https://images.pexels.com/photos/3735156/pexels-photo-3735156.jpeg",
       189, 230, "1 L", 1000, "ml", veg="na", stock=110, hsn="3402"),
    _p("harpic-1l", "Harpic Power Plus Toilet Cleaner", "Harpic", "home-care", "toilet-cleaners",
       "https://images.pexels.com/photos/3735156/pexels-photo-3735156.jpeg",
       149, 195, "1 L", 1000, "ml", veg="na", stock=100),
    _p("goodknight-coil", "Good Knight Activ+ Coil", "Good Knight", "home-care", "air-fresheners",
       "https://images.pexels.com/photos/8939569/pexels-photo-8939569.jpeg",
       45, 55, "10 pc", 10, "pc", veg="na", stock=160),
    _p("garbage-bags-30", "Mr. Lucky Garbage Bags 30 pc", "Mr. Lucky", "home-care", "garbage-wraps",
       "https://images.pexels.com/photos/3735156/pexels-photo-3735156.jpeg",
       75, 99, "30 pc", 30, "pc", veg="na", stock=140),

    # ----- Health & Wellness ----- #
    _p("paracetamol-15tab", "Crocin Pain Relief 500mg", "Crocin", "health-wellness", "otc-firstaid",
       "https://images.pexels.com/photos/3737599/pexels-photo-3737599.jpeg",
       30, 35, "15 tab", 15, "pc", veg="na", stock=80, hsn="3004"),
    _p("revital-h-30", "Revital H Multivitamin (30 caps)", "Revital", "health-wellness", "vitamins-supplements",
       "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg",
       235, 280, "30 cap", 30, "pc", veg="na", stock=60),
    _p("dettol-sanitizer-200ml", "Dettol Instant Hand Sanitizer", "Dettol", "health-wellness", "sanitisers",
       "https://images.pexels.com/photos/4239013/pexels-photo-4239013.jpeg",
       110, 140, "200 ml", 200, "ml", veg="na", stock=120),
    _p("n95-mask-5", "ReSpire N95 Masks (5 pc)", "ReSpire", "health-wellness", "masks-gloves",
       "https://images.pexels.com/photos/3993212/pexels-photo-3993212.jpeg",
       149, 199, "5 pc", 5, "pc", veg="na", stock=80),

    # ----- Household / GM ----- #
    _p("tupperware-1l", "Borosil Glass Container 1L", "Borosil", "household-gm", "kitchen-storage",
       "https://images.pexels.com/photos/4226876/pexels-photo-4226876.jpeg",
       299, 399, "1 L", 1000, "ml", veg="na", stock=40),
    _p("aluminium-foil-72m", "Freshwrapp Aluminium Foil 72m", "Freshwrapp", "household-gm", "foil-zip-locks",
       "https://images.pexels.com/photos/4198015/pexels-photo-4198015.jpeg",
       249, 299, "72 m", 72, "pc", veg="na", stock=70),
    _p("origami-tissue-200", "Origami Wonder Tissues (200 pulls)", "Origami", "household-gm", "paper-products",
       "https://images.pexels.com/photos/1342460/pexels-photo-1342460.jpeg",
       95, 120, "200 pulls", 200, "pc", veg="na", stock=120),
    _p("classmate-notebook", "Classmate Notebook 172 pages", "Classmate", "household-gm", "stationery",
       "https://images.pexels.com/photos/159752/notebook-pen-pencils-school-159752.jpeg",
       60, 75, "1 pc", 1, "pc", veg="na", stock=200),
    _p("eveready-aa-4", "Eveready AA Batteries (4 pc)", "Eveready", "household-gm", "batteries-electricals",
       "https://images.pexels.com/photos/5499/jeans-clothing-wear-blue.jpg",
       89, 110, "4 pc", 4, "pc", veg="na", stock=180),
    _p("pedigree-dog-1kg", "Pedigree Adult Chicken Dry Food", "Pedigree", "household-gm", "pet-care",
       "https://images.pexels.com/photos/4587959/pexels-photo-4587959.jpeg",
       340, 399, "1 kg", 1, "kg", veg="nonveg", stock=50),
    _p("cycle-agarbatti", "Cycle Agarbatti Three In One", "Cycle", "household-gm", "candles-agarbatti",
       "https://images.pexels.com/photos/1416529/pexels-photo-1416529.jpeg",
       45, 60, "100 g", 100, "g", veg="veg", stock=160),
]

PINCODES = [
    {"pincode": "110001", "city": "New Delhi", "delivery_fee": 20, "min_order_value": 99, "eta_minutes": 12, "active": True},
    {"pincode": "110016", "city": "New Delhi (Hauz Khas)", "delivery_fee": 20, "min_order_value": 99, "eta_minutes": 12, "active": True},
    {"pincode": "110024", "city": "New Delhi (Lajpat Nagar)", "delivery_fee": 25, "min_order_value": 99, "eta_minutes": 14, "active": True},
    {"pincode": "201301", "city": "Noida", "delivery_fee": 25, "min_order_value": 149, "eta_minutes": 15, "active": True},
    {"pincode": "122001", "city": "Gurugram", "delivery_fee": 30, "min_order_value": 149, "eta_minutes": 18, "active": True},
]

BANNERS = [
    {"id": new_id(), "title": "Quick delivery in 10 Minutes", "subtitle": "Daily essentials delivered fast to your door.",
     "image": "https://images.pexels.com/photos/6868801/pexels-photo-6868801.jpeg",
     "cta": "Shop now", "link": "/c/food-beverages"},
    {"id": new_id(), "title": "Save big on staples",
     "subtitle": "Atta, oil, dal & spices at unbeatable prices",
     "image": "https://images.pexels.com/photos/6868793/pexels-photo-6868793.jpeg",
     "cta": "Explore", "link": "/c/staples"},
]


DEMO_USERS = [
    ("SUPER_ADMIN_EMAIL", "SUPER_ADMIN_PASSWORD", "super_admin", "Super Admin"),
    ("ADMIN_EMAIL", "ADMIN_PASSWORD", "admin", "Admin"),
    ("OPS_EMAIL", "OPS_PASSWORD", "operations", "Operations User"),
    ("SELLER_EMAIL", "SELLER_PASSWORD", "seller", "VFast Seller"),
    ("RIDER_EMAIL", "RIDER_PASSWORD", "delivery_partner", "VFast Rider"),
    # Real staff accounts — set these env vars in Emergent Secrets
    ("SUPER_ADMIN2_EMAIL", "SUPER_ADMIN2_PASSWORD", "super_admin", "Dinesh Srivastava"),
    ("SUPER_ADMIN3_EMAIL", "SUPER_ADMIN3_PASSWORD", "super_admin", "Pawan Prajapati"),
]


async def _upsert_categories(db):
    """Insert top categories and their subcategories. Subcategories are stored
    in the SAME `categories` collection with parent_id set."""
    for sort_idx, c in enumerate(CATEGORIES, start=1):
        existing = await db.categories.find_one({"slug": c["slug"]})
        if existing:
            top_id = existing["id"]
        else:
            doc = {
                "id": new_id(), "slug": c["slug"], "name": c["name"], "tint": c["tint"],
                "image": c["image"], "parent_id": None, "sort_order": sort_idx,
                "created_at": now_iso(),
            }
            await db.categories.insert_one(doc)
            top_id = doc["id"]
        for sub_idx, (sub_slug, sub_name) in enumerate(c["subcategories"], start=1):
            if await db.categories.find_one({"slug": sub_slug}):
                continue
            await db.categories.insert_one({
                "id": new_id(), "slug": sub_slug, "name": sub_name, "tint": c["tint"],
                "image": "", "parent_id": top_id, "parent_slug": c["slug"],
                "sort_order": sub_idx, "created_at": now_iso(),
            })


async def _upsert_products(db):
    cats = {c["slug"]: c for c in await db.categories.find({}, {"_id": 0}).to_list(500)}
    for p in PRODUCTS:
        if await db.products.find_one({"slug": p["slug"]}):
            continue
        top = cats.get(p["category_slug"])
        sub = cats.get(p["subcategory_slug"])
        if not top:
            continue
        doc = {**p, "category_id": top["id"], "subcategory_id": sub["id"] if sub else None}
        doc.pop("category_slug", None)
        doc.pop("subcategory_slug", None)
        await db.products.insert_one(doc)


async def run_seed(db):
    await _upsert_categories(db)
    await _upsert_products(db)

    for pc in PINCODES:
        if not await db.serviceable_pincodes.find_one({"pincode": pc["pincode"]}):
            await db.serviceable_pincodes.insert_one({"id": new_id(), "created_at": now_iso(), **pc})

    if await db.banners.count_documents({}) == 0:
        await db.banners.insert_many(BANNERS)

    for email_key, pass_key, role, name in DEMO_USERS:
        email = os.environ.get(email_key)
        password = os.environ.get(pass_key)
        if not email or not password:
            continue
        if await db.users.find_one({"email": email}):
            continue
        await db.users.insert_one({
            "id": new_id(), "email": email, "password_hash": hash_password(password),
            "name": name, "role": role, "created_at": now_iso(),
        })

    demo_phone = os.environ.get("DEMO_CUSTOMER_PHONE")
    if demo_phone:
        existing = await db.users.find_one({"phone": demo_phone})
        if not existing:
            await db.users.insert_one({
                "id": new_id(), "phone": demo_phone, "name": "Demo Customer",
                "role": "customer", "active": True, "created_at": now_iso(),
            })
        elif existing.get("active") is False:
            # Re-activate on every boot so demo / test runs aren't blocked.
            await db.users.update_one({"id": existing["id"]}, {"$set": {"active": True}})

    if await db.qr_codes.count_documents({}) == 0:
        await db.qr_codes.insert_one({
            "id": new_id(),
            "label": "VFast Default UPI QR",
            "upi_id": "vfast@upi",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/QR_code_for_mobile_English_Wikipedia.svg/240px-QR_code_for_mobile_English_Wikipedia.svg.png",
            "scope": "global", "active": True, "created_at": now_iso(),
        })

    # Default dark store + zone + demo rider + global settings
    if await db.dark_stores.count_documents({}) == 0:
        await db.dark_stores.insert_one({
            "id": new_id(), "name": "Delhi-NCR Hub Store",
            "address": "Sector 18, Noida, Uttar Pradesh",
            "pincodes": ["110001", "110016", "110024", "201301", "122001"],
            "manager_email": os.environ.get("OPS_EMAIL", "ops@vfast.local"),
            "operating_hours": "08:00-23:30", "active": True,
            "created_at": now_iso(),
        })

    if await db.zones.count_documents({}) == 0:
        store = await db.dark_stores.find_one({}, {"_id": 0, "id": 1})
        await db.zones.insert_one({
            "id": new_id(), "name": "Delhi-NCR Core",
            "pincodes": ["110001", "110016", "110024"],
            "store_id": store["id"] if store else None,
            "active": True, "created_at": now_iso(),
        })

    # Backfill reorder_level on existing products
    await db.products.update_many({"reorder_level": {"$exists": False}}, {"$set": {"reorder_level": 5}})

    # Ensure default settings doc exists
    if not await db.settings.find_one({"id": "global"}):
        await db.settings.insert_one({
            "id": "global",
            "settings": {
                "app_name": "VFast", "support_email": "support@vfast.local",
                "support_phone": "+91 1800-000-000", "dpo_email": "dpo@vmart.local",
                "dpo_phone": "+91 1800-000-001", "maintenance_mode": False,
            },
            "flags": {
                "cod_enabled": True, "upi_qr_enabled": True, "referrals_enabled": False,
                "wallet_enabled": False, "hindi_toggle_enabled": True, "dpdp_consent_banner": True,
            },
        })

    log.info("FMCG seed complete: %d products, %d categories", await db.products.count_documents({}), await db.categories.count_documents({}))
