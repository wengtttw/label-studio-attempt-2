import pytest
from jwt_auth.models import LSAPIToken, LSTokenBackend
from organizations.models import OrganizationMember
from organizations.tests.factories import OrganizationFactory
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings as simple_jwt_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from users.models import User

from ..utils import mock_feature_flag
from .utils import create_user_with_token_settings


@mock_feature_flag(flag_name='fflag__feature_develop__prompts__dia_1829_jwt_token_auth', value=True)
@pytest.mark.django_db
def test_jwt_settings_permissions():
    org = OrganizationFactory()
    user = org.created_by

    # Any member should be able to view
    assert org.jwt.has_view_permission(user)

    # Any LSO member should be able to modify
    # (tests for enterprise handled in enterprise test suite)
    assert org.jwt.has_modify_permission(user)
    assert org.jwt.has_permission(user)


@mock_feature_flag(flag_name='fflag__feature_develop__prompts__dia_1829_jwt_token_auth', value=True)
@pytest.mark.django_db
def test_non_owner_user_can_modify_jwt_settings():
    """Test that a regular non-owner user who is added to an organization can modify JWT settings"""
    org = OrganizationFactory()
    non_owner = User.objects.create(email='regular_user@example.com')

    OrganizationMember.objects.create(
        user=non_owner,
        organization=org,
    )
    non_owner.active_organization = org
    non_owner.save()

    assert org.jwt.has_view_permission(non_owner)
    assert org.jwt.has_modify_permission(non_owner)
    assert org.jwt.has_permission(non_owner)


@mock_feature_flag(flag_name='fflag__feature_develop__prompts__dia_1829_jwt_token_auth', value=True)
@pytest.mark.django_db
def test_user_from_other_org_cannot_access_jwt_settings():
    """Test that users from other organizations cannot view or modify JWT settings"""
    org1 = OrganizationFactory()
    org1_owner = org1.created_by

    org2 = OrganizationFactory()
    org2_owner = org2.created_by

    # Verify org1 owner cannot view or modify JWT settings of org2
    assert not org2.jwt.has_view_permission(org1_owner)
    assert not org2.jwt.has_modify_permission(org1_owner)
    assert not org2.jwt.has_permission(org1_owner)

    # Verify org2 owner cannot view or modify JWT settings of org1
    assert not org1.jwt.has_view_permission(org2_owner)
    assert not org1.jwt.has_modify_permission(org2_owner)
    assert not org1.jwt.has_permission(org2_owner)


@mock_feature_flag(flag_name='fflag__feature_develop__prompts__dia_1829_jwt_token_auth', value=True)
@pytest.fixture
def token_backend():
    return LSTokenBackend(
        algorithm=simple_jwt_settings.ALGORITHM,
        signing_key=simple_jwt_settings.SIGNING_KEY,
        verifying_key=simple_jwt_settings.VERIFYING_KEY,
        audience=simple_jwt_settings.AUDIENCE,
        issuer=simple_jwt_settings.ISSUER,
        jwk_url=simple_jwt_settings.JWK_URL,
        leeway=simple_jwt_settings.LEEWAY,
        json_encoder=simple_jwt_settings.JSON_ENCODER,
    )


@mock_feature_flag(flag_name='fflag__feature_develop__prompts__dia_1829_jwt_token_auth', value=True)
def test_encode_returns_only_header_and_payload(token_backend):
    payload = {
        'user_id': 123,
        'exp': 1735689600,  # 2025-01-01
        'iat': 1704153600,  # 2024-01-02
    }
    token = token_backend.encode(payload)

    parts = token.split('.')
    assert len(parts) == 2

    assert all(part.replace('-', '+').replace('_', '/') for part in parts)
    assert all(part.replace('-', '+').replace('_', '/') for part in parts)


@mock_feature_flag(flag_name='fflag__feature_develop__prompts__dia_1829_jwt_token_auth', value=True)
def test_encode_full_returns_complete_jwt(token_backend):
    payload = {
        'user_id': 123,
        'exp': 1735689600,  # 2025-01-01
        'iat': 1704153600,  # 2024-01-02
    }
    token = token_backend.encode_full(payload)

    parts = token.split('.')
    assert len(parts) == 3

    assert all(part.replace('-', '+').replace('_', '/') for part in parts)


@mock_feature_flag(flag_name='fflag__feature_develop__prompts__dia_1829_jwt_token_auth', value=True)
def test_encode_vs_encode_full_comparison(token_backend):
    payload = {
        'user_id': 123,
        'exp': 1735689600,  # 2025-01-01
        'iat': 1704153600,  # 2024-01-02
    }
    partial_token = token_backend.encode(payload)
    full_token = token_backend.encode_full(payload)

    assert full_token.startswith(partial_token)


@mock_feature_flag(flag_name='fflag__feature_develop__prompts__dia_1829_jwt_token_auth', value=True)
@pytest.mark.django_db
def test_token_lifecycle():
    """Test full token lifecycle including creation, access token generation, blacklisting, and validation"""
    user = create_user_with_token_settings(api_tokens_enabled=True, legacy_api_tokens_enabled=False)
    token = LSAPIToken.for_user(user)

    # Test that the token is valid
    assert token.check_blacklist() is None

    # Test that blacklisting the token works
    token.blacklist()
    assert BlacklistedToken.objects.filter(token__jti=token['jti']).exists()

    # Test that the blacklisted token is detected
    with pytest.raises(TokenError):
        token.check_blacklist()


@pytest.mark.django_db
def test_token_creation_and_storage():
    """Test that tokens are created and stored correctly with truncated format"""
    user = create_user_with_token_settings(api_tokens_enabled=True, legacy_api_tokens_enabled=False)
    token = LSAPIToken.for_user(user)
    assert token is not None

    # Token in database shouldn't contain the signature
    outstanding_token = OutstandingToken.objects.get(jti=token['jti'])
    stored_token_parts = outstanding_token.token.split('.')
    assert len(stored_token_parts) == 2  # Only header and payload

    # Full token should have all three JWT parts
    full_token = token.get_full_jwt()
    full_token_parts = full_token.split('.')
    assert len(full_token_parts) == 3  # Header, payload, and signature
