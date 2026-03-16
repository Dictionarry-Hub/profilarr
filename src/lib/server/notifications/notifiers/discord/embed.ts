/**
 * Discord Embed Builder
 * Fluent API for constructing Discord webhook embeds
 */

/**
 * Discord embed color constants
 */
export const Colors = {
	SUCCESS: 0x4a90d9,
	FAILED: 0xff0000,
	ERROR: 0xff0000,
	INFO: 0x0099ff,
	WARNING: 0xffaa00,
	PREVIEW: 0x9b59b6
} as const;

/**
 * Instance type icons
 */
export const Icons = {
	RADARR: '🎬',
	SONARR: '📺',
	LIDARR: '🎵',
	READARR: '📚',
	FOLDER: '📁'
} as const;

/**
 * Get icon for an instance type
 */
export function getInstanceIcon(type: string): string {
	const icons: Record<string, string> = {
		radarr: Icons.RADARR,
		sonarr: Icons.SONARR,
		lidarr: Icons.LIDARR,
		readarr: Icons.READARR
	};
	return icons[type.toLowerCase()] || Icons.FOLDER;
}

/**
 * Discord embed field structure
 */
export interface EmbedField {
	name: string;
	value: string;
	inline?: boolean;
}

/**
 * Discord embed author structure
 */
export interface EmbedAuthor {
	name: string;
	url?: string;
	icon_url?: string;
}

/**
 * Discord embed footer structure
 */
export interface EmbedFooter {
	text: string;
	icon_url?: string;
}

/**
 * Discord embed structure
 */
export interface DiscordEmbed {
	title?: string;
	description?: string;
	url?: string;
	color?: number;
	timestamp?: string;
	author?: EmbedAuthor;
	footer?: EmbedFooter;
	fields?: EmbedField[];
	thumbnail?: { url: string };
	image?: { url: string };
}

/**
 * Fluent builder for Discord embeds
 *
 * @example
 * const embed = new EmbedBuilder()
 *   .author('🎬 Radarr')
 *   .title('Rename Complete')
 *   .description('Renamed 5 files')
 *   .field('Files', '5/5', true)
 *   .field('Mode', 'Live', true)
 *   .color(Colors.SUCCESS)
 *   .timestamp()
 *   .footer('Profilarr')
 *   .build();
 */
export class EmbedBuilder {
	private data: DiscordEmbed = {};

	/**
	 * Set the embed title
	 */
	title(text: string): this {
		this.data.title = text;
		return this;
	}

	/**
	 * Set the embed description
	 */
	description(text: string): this {
		this.data.description = text;
		return this;
	}

	/**
	 * Build description from multiple lines
	 * Filters out null/undefined/empty/false values
	 */
	lines(messageLines: (string | null | undefined | false)[]): this {
		this.data.description = messageLines.filter(Boolean).join('\n').trim();
		return this;
	}

	/**
	 * Set the embed URL (makes title clickable)
	 */
	url(link: string): this {
		this.data.url = link;
		return this;
	}

	/**
	 * Set the embed color
	 */
	color(value: number): this {
		this.data.color = value;
		return this;
	}

	/**
	 * Set the embed timestamp
	 * @param date - Date to use, defaults to now
	 */
	timestamp(date?: Date): this {
		this.data.timestamp = (date || new Date()).toISOString();
		return this;
	}

	/**
	 * Set the embed author
	 */
	author(name: string, iconUrl?: string, url?: string): this {
		this.data.author = { name };
		if (iconUrl) this.data.author.icon_url = iconUrl;
		if (url) this.data.author.url = url;
		return this;
	}

	/**
	 * Set the embed footer
	 */
	footer(text: string, iconUrl?: string): this {
		this.data.footer = { text };
		if (iconUrl) this.data.footer.icon_url = iconUrl;
		return this;
	}

	/**
	 * Add a field to the embed
	 */
	field(name: string, value: string, inline?: boolean): this {
		if (!this.data.fields) {
			this.data.fields = [];
		}
		this.data.fields.push({ name, value, inline });
		return this;
	}

	/**
	 * Add multiple fields at once
	 */
	fields(fieldList: EmbedField[]): this {
		if (!this.data.fields) {
			this.data.fields = [];
		}
		this.data.fields.push(...fieldList);
		return this;
	}

	/**
	 * Conditionally add a field
	 */
	fieldIf(condition: boolean, name: string, value: string, inline?: boolean): this {
		if (condition) {
			this.field(name, value, inline);
		}
		return this;
	}

	/**
	 * Set the embed thumbnail
	 */
	thumbnail(imageUrl: string): this {
		this.data.thumbnail = { url: imageUrl };
		return this;
	}

	/**
	 * Set the embed image
	 */
	image(imageUrl: string): this {
		this.data.image = { url: imageUrl };
		return this;
	}

	/**
	 * Build the final embed object
	 */
	build(): DiscordEmbed {
		return { ...this.data };
	}
}

/**
 * Create a new embed builder
 *
 * @example
 * const embed = createEmbed()
 *   .title('Success')
 *   .color(Colors.SUCCESS)
 *   .build();
 */
export function createEmbed(): EmbedBuilder {
	return new EmbedBuilder();
}
