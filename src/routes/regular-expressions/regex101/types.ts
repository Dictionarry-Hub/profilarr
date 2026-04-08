export interface Regex101UnitTest {
	description: string;
	testString: string;
	criteria: 'DOES_MATCH' | 'DOES_NOT_MATCH';
	actual?: boolean;
	passed?: boolean;
}

export interface Regex101Response {
	permalinkFragment: string;
	version: number;
	regex: string;
	flags: string;
	flavor: string;
	unitTests: Regex101UnitTest[];
}
