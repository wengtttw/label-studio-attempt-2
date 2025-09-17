"""
Tests for UUID7 utilities in the FSM system.

Tests the uuid-utils library integration and UUID7 functionality.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

# Additional imports for transition_utils coverage tests
import pytest
from django.test import TestCase
from fsm.registry import transition_registry
from fsm.transition_utils import (
    create_transition_from_dict,
    get_available_transitions,
    get_entity_state_flow,
    validate_transition_data,
)
from fsm.transitions import BaseTransition, TransitionValidationError
from fsm.utils import (
    UUID7Generator,
    generate_uuid7,
    timestamp_from_uuid7,
    uuid7_from_timestamp,
    uuid7_time_range,
    validate_uuid7,
)
from pydantic import Field


class TestUUID7Utils(TestCase):
    """Test UUID7 utility functions"""

    def test_generate_uuid7(self):
        """Test UUID7 generation"""
        uuid7_id = generate_uuid7()

        # Check that it's a valid UUID
        assert isinstance(uuid7_id, uuid.UUID)

        # Check that it's version 7
        assert uuid7_id.version == 7

        # Check that it validates as UUID7
        assert validate_uuid7(uuid7_id)

    def test_uuid7_ordering(self):
        """Test that UUID7s have natural time ordering"""
        uuid1 = generate_uuid7()
        uuid2 = generate_uuid7()

        # UUID7s should be ordered by generation time
        assert uuid1.int < uuid2.int

    def test_timestamp_extraction(self):
        """Test timestamp extraction from UUID7"""
        before = datetime.now(timezone.utc)
        uuid7_id = generate_uuid7()
        after = datetime.now(timezone.utc)

        extracted_timestamp = timestamp_from_uuid7(uuid7_id)

        # Timestamp should be close to the generation time (within 1 second tolerance)
        # UUID7 has millisecond precision, so some rounding variance is expected
        time_diff_before = abs((extracted_timestamp - before).total_seconds())
        time_diff_after = abs((extracted_timestamp - after).total_seconds())

        assert time_diff_before < 1.0  # Within 1 second of before
        assert time_diff_after < 1.0   # Within 1 second of after

    def test_uuid7_from_timestamp(self):
        """Test creating UUID7 from specific timestamp"""
        test_time = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        uuid7_id = uuid7_from_timestamp(test_time)

        # Should be a valid UUID7
        assert validate_uuid7(uuid7_id)

        # Extracted timestamp should match (within millisecond precision)
        extracted = timestamp_from_uuid7(uuid7_id)
        time_diff = abs((extracted - test_time).total_seconds())
        assert time_diff < 0.001  # Within 1ms

    def test_uuid7_time_range(self):
        """Test UUID7 time range generation"""
        start_time = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        end_time = datetime(2024, 1, 15, 13, 0, 0, tzinfo=timezone.utc)

        start_uuid, end_uuid = uuid7_time_range(start_time, end_time)

        # Both should be valid UUID7s
        assert validate_uuid7(start_uuid)
        assert validate_uuid7(end_uuid)

        # Start should be less than end
        assert start_uuid.int < end_uuid.int

        # Timestamps should match input times (with 1ms buffer tolerance)
        start_extracted = timestamp_from_uuid7(start_uuid)
        end_extracted = timestamp_from_uuid7(end_uuid)

        # Account for 1ms buffer added in uuid7_time_range
        assert abs((start_extracted - start_time).total_seconds()) < 0.002
        assert abs((end_extracted - end_time).total_seconds()) < 0.002

    def test_uuid7_time_range_default_end(self):
        """Test UUID7 time range with default end time (now)"""
        start_time = datetime.now(timezone.utc) - timedelta(hours=1)
        before_call = datetime.now(timezone.utc)

        start_uuid, end_uuid = uuid7_time_range(start_time)

        after_call = datetime.now(timezone.utc)

        # End timestamp should be close to now (within 1 second tolerance)
        end_extracted = timestamp_from_uuid7(end_uuid)
        time_diff_before = abs((end_extracted - before_call).total_seconds())
        time_diff_after = abs((end_extracted - after_call).total_seconds())

        assert time_diff_before < 1.0  # Within 1 second of before_call
        assert time_diff_after < 1.0   # Within 1 second of after_call

    def test_validate_uuid7_with_other_versions(self):
        """Test UUID7 validation with other UUID versions"""
        # Test with UUID4
        uuid4_id = uuid.uuid4()
        assert not validate_uuid7(uuid4_id)

        # Test with UUID7
        uuid7_id = generate_uuid7()
        assert validate_uuid7(uuid7_id)


class TestUUID7Generator(TestCase):
    """Test UUID7Generator class"""

    def test_generator_basic(self):
        """Test basic UUID7 generator functionality"""
        generator = UUID7Generator()

        uuid7_id = generator.generate()
        assert validate_uuid7(uuid7_id)

    def test_generator_with_base_timestamp(self):
        """Test generator with custom base timestamp"""
        base_time = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        generator = UUID7Generator(base_timestamp=base_time)

        uuid7_id = generator.generate()
        extracted = timestamp_from_uuid7(uuid7_id)

        # Should be close to base time
        time_diff = abs((extracted - base_time).total_seconds())
        assert time_diff < 0.001

    def test_generator_with_offset(self):
        """Test generator with timestamp offset"""
        base_time = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        generator = UUID7Generator(base_timestamp=base_time)

        # Generate UUID with 1 second offset
        uuid7_id = generator.generate(offset_ms=1000)
        extracted = timestamp_from_uuid7(uuid7_id)

        expected_time = base_time + timedelta(milliseconds=1000)
        time_diff = abs((extracted - expected_time).total_seconds())
        assert time_diff < 0.001

    def test_generator_monotonic(self):
        """Test that generator produces monotonic UUIDs"""
        base_time = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        generator = UUID7Generator(base_timestamp=base_time)

        # Generate multiple UUIDs with same timestamp but different counters
        uuid1 = generator.generate(offset_ms=100)
        uuid2 = generator.generate(offset_ms=100)
        uuid3 = generator.generate(offset_ms=100)

        # Should be monotonic even with same timestamp
        assert uuid1.int < uuid2.int
        assert uuid2.int < uuid3.int


class MockEntity:
    """Mock entity for testing"""

    def __init__(self, pk=1):
        self.pk = pk
        self.id = pk
        self._meta = Mock()
        self._meta.model_name = 'testentity'
        self._meta.label_lower = 'tests.testentity'
        self.organization_id = 1


class TransitionUtilsTests(TestCase):
    """Tests for transition_utils module edge cases and error handling"""

    def setUp(self):
        # Clear registries to ensure clean state
        from fsm.registry import state_choices_registry, state_model_registry

        state_choices_registry.clear()
        state_model_registry.clear()
        transition_registry.clear()

        self.entity = MockEntity()

    def test_transition_utils_unexpected_validation_error(self):
        """Test unexpected error during transition validation in get_available_transitions"""

        class BrokenTransition(BaseTransition):
            """Transition that raises unexpected error"""

            @property
            def target_state(self) -> str:
                return 'BROKEN'

            def transition(self, context):
                return {}

            @classmethod
            def can_transition_from_state(cls, context):
                # Raise unexpected error
                raise RuntimeError('Unexpected validation error')

        # Register the broken transition
        transition_registry.register('testentity', 'broken_transition', BrokenTransition)

        # Should handle the error gracefully and log warning
        with patch('fsm.transition_utils.logger') as mock_logger:
            result = get_available_transitions(self.entity, validate=True)
            # Should not include the broken transition
            assert 'broken_transition' not in result
            # Should have logged the warning
            mock_logger.warning.assert_called_once()
            assert 'Unexpected error validating transition' in mock_logger.warning.call_args[0][0]

    def test_transition_utils_validation_error_handling(self):
        """Test TransitionValidationError handling in get_available_transitions"""

        class ValidatingTransition(BaseTransition):
            """Transition that raises validation error"""

            @property
            def target_state(self) -> str:
                return 'VALIDATED'

            def transition(self, context):
                return {}

            @classmethod
            def can_transition_from_state(cls, context):
                raise TransitionValidationError('Not allowed from this state')

        transition_registry.register('testentity', 'validating_transition', ValidatingTransition)

        # Should exclude invalid transitions without logging
        import logging

        mock_logger = Mock()
        with patch.object(logging, 'getLogger', return_value=mock_logger):
            result = get_available_transitions(self.entity, validate=True)
            assert 'validating_transition' not in result
            # Should not log for expected validation errors
            mock_logger.warning.assert_not_called()

    def test_transition_utils_create_from_dict_error(self):
        """Test create_transition_from_dict error handling"""

        class StrictTransition(BaseTransition):
            """Transition with strict validation"""

            required_field: str = Field(...)

            @property
            def target_state(self) -> str:
                return 'STRICT'

            def transition(self, context):
                return {'required_field': self.required_field}

        # Should raise ValueError with helpful message
        with pytest.raises(ValueError) as exc_info:
            create_transition_from_dict(StrictTransition, {})

        assert 'Failed to create StrictTransition' in str(exc_info.value)

    def test_transition_utils_validate_transition_data_errors(self):
        """Test validate_transition_data with various error cases"""

        class ValidationTransition(BaseTransition):
            """Transition with various field types"""

            required_field: str = Field(...)
            number_field: int = Field(default=0, ge=0)

            @property
            def target_state(self) -> str:
                return 'VALIDATED'

            def transition(self, context):
                return {'required_field': self.required_field, 'number_field': self.number_field}

        # Test with missing required field
        errors = validate_transition_data(ValidationTransition, {})
        assert 'required_field' in errors
        assert any('required' in msg.lower() or 'missing' in msg.lower() for msg in errors['required_field'])

        # Test with invalid type
        errors = validate_transition_data(
            ValidationTransition, {'required_field': 123, 'number_field': 'not_a_number'}
        )
        # Either required_field or number_field should have type error
        assert len(errors) > 0

        # Test with validation constraint violation
        errors = validate_transition_data(ValidationTransition, {'required_field': 'test', 'number_field': -1})
        assert 'number_field' in errors

        # Test valid data returns empty dict
        errors = validate_transition_data(ValidationTransition, {'required_field': 'test', 'number_field': 5})
        assert errors == {}

    def test_transition_utils_validate_with_non_pydantic_error(self):
        """Test validate_transition_data with non-Pydantic errors"""

        class CustomErrorTransition(BaseTransition):
            """Transition that raises custom error in __init__"""

            @property
            def target_state(self) -> str:
                return 'ERROR'

            def transition(self, context):
                return {}

            def __init__(self, **data):
                # Raise a non-ValidationError
                if 'trigger_error' in data:
                    raise RuntimeError('Custom initialization error')
                super().__init__(**data)

        errors = validate_transition_data(CustomErrorTransition, {'trigger_error': True})
        assert '__root__' in errors
        assert 'Custom initialization error' in errors['__root__'][0]

    def test_transition_utils_entity_state_flow_errors(self):
        """Test get_entity_state_flow with transitions that can't be instantiated"""

        class RequiredFieldTransition(BaseTransition):
            """Transition requiring fields to instantiate"""

            required_field: str = Field(...)

            @property
            def target_state(self) -> str:
                return 'REQUIRED'

            def transition(self, context):
                return {'required_field': self.required_field}

        transition_registry.register('testentity', 'required_transition', RequiredFieldTransition)

        # Should skip transitions that can't be instantiated
        flows = get_entity_state_flow(self.entity)
        # Should not include the transition that requires fields
        assert not any(f['transition_name'] == 'required_transition' for f in flows)
