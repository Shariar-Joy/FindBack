from datetime import datetime, timedelta, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.models import Role, SightingStatus, Status, Visibility
from app.regions import DIVISIONS


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def strong_password(value: str) -> str:
    if len(value) < 12 or len(value) > 128 or not any(c.islower() for c in value) or not any(c.isupper() for c in value) or not any(c.isdigit() for c in value):
        raise ValueError("Use 12–128 characters including uppercase, lowercase and a number")
    return value


class Register(Input):
    display_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str
    accept_terms: Literal[True]
    _password = field_validator("password")(strong_password)


class Login(Input):
    email: EmailStr
    password: str = Field(max_length=128)
    remember: bool = False


class Forgot(Input):
    email: EmailStr


class Reset(Input):
    token: str = Field(min_length=20, max_length=200)
    password: str
    _password = field_validator("password")(strong_password)


class CaseInput(Input):
    person_name: str = Field(min_length=2, max_length=120)
    approximate_age: int | None = Field(default=None, ge=0, le=120)
    description: str = Field(min_length=10, max_length=4000)
    clothing_description: str = Field(min_length=3, max_length=2000)
    additional_context: str = Field(default="", max_length=4000)
    last_seen_at: datetime
    country_code: Literal["BD"] = "BD"
    division: str = Field(max_length=80)
    district: str = Field(max_length=80)
    city: str = Field(min_length=2, max_length=100)
    area_name: str = Field(min_length=2, max_length=160)
    relationship: str = Field(min_length=2, max_length=120)
    private_contact_method: Literal["email", "phone"]
    private_contact_value: str = Field(min_length=5, max_length=254)
    acknowledgement: Literal[True]

    @field_validator("last_seen_at")
    @classmethod
    def past_date(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("Include a timezone")
        if v > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError("Date cannot be in the future")
        return v

    @field_validator("district")
    @classmethod
    def valid_district(cls, v: str, info):
        if v not in DIVISIONS.get(info.data.get("division"), []):
            raise ValueError("Select a district in this division")
        return v


class SightingInput(Input):
    observed_at: datetime
    location_description: str = Field(min_length=5, max_length=500)
    notes: str = Field(min_length=10, max_length=4000)
    safe_contact: str = Field(default="", max_length=254)
    consent: Literal[True]
    _observed = field_validator("observed_at")(CaseInput.past_date.__func__)


class Review(Input):
    decision: Literal["APPROVED", "REJECTED", "CORRECTIONS", "DUPLICATE"]
    reason: str = Field(default="", max_length=2000)
    public_area_code: str | None = None
    approve_photo: bool = False
    person_name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, min_length=10, max_length=4000)
    clothing_description: str | None = Field(default=None, min_length=3, max_length=2000)
    area_name: str | None = Field(default=None, min_length=2, max_length=160)
    additional_context: str | None = Field(default=None, max_length=4000)


class Reason(Input):
    reason: str = Field(min_length=5, max_length=2000)


class VisibilityInput(Reason):
    visibility: Visibility


class SightingReview(Input):
    status: Literal["REVIEWED", "DISMISSED"]
    notes: str = Field(default="", max_length=2000)


class SubscriptionInput(Input):
    area_code: str = Field(max_length=80)


class Profile(Input):
    display_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    current_password: str = Field(max_length=128)
    email_alerts: bool = True


class ChangePassword(Input):
    current_password: str = Field(max_length=128)
    password: str
    _password = field_validator("password")(strong_password)


class Deactivate(Input):
    current_password: str = Field(max_length=128)


class AdminUser(Input):
    role: Role
    is_active: bool
    reason: str = Field(min_length=5, max_length=1000)


class AbuseReview(Input):
    decision: str = Field(min_length=5, max_length=2000)
    hide_case: bool = False


class PublicCase(BaseModel):
    case_code: str
    person_name: str
    approximate_age: int | None
    description: str
    clothing_description: str
    additional_context: str
    last_seen_date: str
    country_code: str
    division: str
    district: str
    city: str
    area_name: str
    status: Status
    publication_visibility: Visibility
    public_location: list[float] | None
    photo_url: str | None
    published_at: datetime | None
    is_demo: bool
