<!--
Sync Impact Report
- Version change: unratified template -> 1.0.0
- Modified principles: five template placeholders replaced with MVP principles
- Added sections: Technical Constraints; Development Workflow and Quality Gates
- Removed sections: none
- Follow-up TODOs: none
-->

# Pied Piper Constitution

## Core Principles

### I. Single Lead Melody MVP

The initial release MUST transcribe one best-effort lead melody per audio submission.
Multi-part and full-arrangement transcription MUST remain out of scope until a later
constitution amendment and feature specification approve it. This boundary keeps the
first release focused on a useful, demonstrable user outcome.

### II. Honest Transcription

The system MUST distinguish confident results from uncertain notes or sections. It MUST
explain when audio conditions prevent a reliable transcription and MUST NOT present an
uncertain result as certain. A missing or qualified result is preferable to misleading
tabs.

### III. Audio Privacy

Submitted audio MUST be used only to produce the requested transcription and MUST be
discarded when processing and result delivery no longer require it. Audio MUST NOT be
retained, reused, or shared for another purpose without the user's explicit consent.
Logs and error reports MUST NOT contain audio content or credentials.

### IV. Complete, Simple User Journey

The MVP MUST support a clear path from browser audio capture or file upload to a
reviewable chromatic harmonica tab. Features MUST directly support that journey or be
deferred. The experience MUST give understandable feedback for unsupported input,
processing failure, and uncertain results.

### V. Fit-for-Purpose Validation

Each user-visible capability MUST have acceptance criteria tied to the feature
specification. Audio transcription quality MUST be evaluated on representative clear
lead-melody recordings, and failure cases MUST be covered. Claims about accuracy or
device support MUST be supported by recorded evidence.

## Technical Constraints

- The frontend MUST use TypeScript.
- The backend MUST use Fastify.
- Audio processing MUST run in the backend using Python.
- The returned tabs MUST identify the harmonica tuning and use a consistent notation
  convention. The initial default is a C-tuned, 12-hole chromatic harmonica unless the
  approved feature specification changes that default.

## Development Workflow and Quality Gates

- Feature work MUST proceed through a reviewed specification, implementation plan, and
  dependency-ordered task list before implementation.
- Implementation MUST satisfy the approved acceptance criteria and MUST NOT silently
  expand the agreed MVP scope.
- Changes to user-visible behavior, data handling, or technical constraints MUST be
  reflected in the relevant specification or plan.
- Audio retention and uncertainty behavior MUST be reviewed for every change that
  affects audio processing or transcription results.

## Governance

This constitution governs project specifications, plans, tasks, and implementation.
Every proposed change MUST be checked against its principles and constraints. Amendments
MUST update this document and its version together. Version changes follow semantic
versioning: MAJOR for incompatible principle or constraint changes, MINOR for new or
materially expanded principles or sections, and PATCH for clarifications that do not
change governance meaning. The constitution MUST be reviewed whenever a feature changes
the MVP boundary, audio handling, transcription confidence behavior, or required stack.

**Version**: 1.0.0 | **Ratified**: 2026-10-24 | **Last Amended**: 2026-10-24
