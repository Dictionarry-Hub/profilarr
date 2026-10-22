-- @operation: export
-- @entity: batch
-- @name: fixed condition name
-- @exportedAt: 2026-10-22T09:48:36.737Z
-- @opIds: 3033, 3034

-- --- BEGIN op 3033 ( update custom_format "Title Match" )
DELETE FROM custom_format_conditions
	WHERE custom_format_name = 'Title Match'
	  AND name = 'Title Regex'
	  AND type = 'release_title'
	  AND arr_type = 'all'
	  AND negate = 0
	  AND required = 0;
-- --- END op 3033

-- --- BEGIN op 3034 ( update custom_format "Title Match" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Title Match', 'Title', 'release_title', 'all', 0, 0);

INSERT INTO condition_patterns (custom_format_name, condition_name, regular_expression_name) VALUES ('Title Match', 'Title', 'Title Regex');
-- --- END op 3034
