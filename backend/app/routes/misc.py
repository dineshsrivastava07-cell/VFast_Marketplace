"""Health + misc."""
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api")


@router.get("/")
async def root():
    return {"app": "VFast Marketplace API", "status": "ok"}


@router.get("/health")
async def health(request: Request):
    db = request.state.db
    await db.command("ping")
    return {"status": "ok", "db": "up"}


@router.get("/i18n/dictionary")
async def i18n_dictionary():
    """Tiny EN/HI dictionary used by the frontend i18n toggle."""
    return {
        "en": {
            "delivery_to": "Delivery to",
            "search_placeholder": "Search for milk, bread, eggs...",
            "view_cart": "View Cart",
            "add": "ADD",
            "place_order": "Place Order",
            "cod": "Cash on Delivery",
            "upi_qr": "UPI QR (Scan & Pay)",
            "login_with_otp": "Login with OTP",
            "phone_label": "Mobile number",
            "send_otp": "Send OTP",
            "verify": "Verify",
            "minutes": "min",
            "shop_categories": "Shop by category",
            "popular_now": "Popular right now",
            "free_delivery_above": "Free delivery on orders above",
            "your_cart": "Your cart",
        },
        "hi": {
            "delivery_to": "डिलीवरी",
            "search_placeholder": "दूध, ब्रेड, अंडे खोजें...",
            "view_cart": "कार्ट देखें",
            "add": "जोड़ें",
            "place_order": "ऑर्डर करें",
            "cod": "कैश ऑन डिलीवरी",
            "upi_qr": "UPI QR (स्कैन और पे)",
            "login_with_otp": "OTP से लॉगिन",
            "phone_label": "मोबाइल नंबर",
            "send_otp": "OTP भेजें",
            "verify": "सत्यापित करें",
            "minutes": "मिनट",
            "shop_categories": "श्रेणी से खरीदें",
            "popular_now": "अभी लोकप्रिय",
            "free_delivery_above": "इतने से ऊपर मुफ्त डिलीवरी",
            "your_cart": "आपकी कार्ट",
        },
    }
