export interface HelpItem {
  description: string;
  name: string;
}

export interface HelpSubcommand {
  description: string;
  name: string;
  usage: string;
}

export interface CommandHelp {
  description: string;
  modes?: HelpItem[];
  name: string;
  permissions: string;
  subcommands: HelpSubcommand[];
}
