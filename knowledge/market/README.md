# Market Layer

Public data, research reports, and industry analyses. Higher volume, faster decay than core or frameworks.

## Planned sources

*Research reports (periodic ingest):*
- McKinsey Global Institute — industry and economic reports
- Deloitte Insights — technology and business trends
- Pew Research — consumer and social data

*Industry-specific:*
- Pharma/health market data
- AI and technology landscape reports
- Brand and marketing effectiveness research

## Structure
```
market/
├── [year]/
│   └── [report-name].md     # Processed report excerpts
└── [topic]/
    └── [source-name].md
```

## Update frequency
Periodic ingests as new reports are published or needed.

## Note on sourcing
Do not ingest full copyrighted reports. Ingest extracted data points, key findings, and synthesized takeaways with proper attribution.
