"""Usuarios, tokens de renovación y auditoría de solo inserción.

Revision ID: 0001
"""
import os

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    ahora = sa.text("now()")
    op.create_table(
        "usuarios",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("usuario", sa.String(60), nullable=False, unique=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("rol", sa.String(20), nullable=False),
        sa.Column("tipo_destinatario", sa.String(10)),
        sa.Column("hash_contrasena", sa.Text, nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("fallos", sa.Integer, nullable=False, server_default="0"),
        sa.Column("bloqueado_hasta", sa.DateTime(timezone=True)),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False, server_default=ahora),
        sa.CheckConstraint("rol IN ('ti', 'ce', 'receptor')", name="rol_valido"),
        sa.CheckConstraint("(rol = 'receptor') = (tipo_destinatario IS NOT NULL)", name="destinatario_solo_receptor"),
    )
    op.create_table(
        "renovaciones",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False, index=True),
        sa.Column("familia", sa.String(36), nullable=False, index=True),
        sa.Column("huella", sa.String(64), nullable=False, unique=True),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usado_en", sa.DateTime(timezone=True)),
        sa.Column("revocado_en", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "auditoria",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False, server_default=ahora, index=True),
        sa.Column("tipo", sa.String(20), nullable=False, index=True),
        sa.Column("accion", sa.String(120), nullable=False),
        sa.Column("resultado", sa.String(10), nullable=False),
        sa.Column("usuario", sa.String(60), nullable=False, server_default=""),
        sa.Column("rol", sa.String(20), nullable=False, server_default=""),
        sa.Column("detalle", sa.Text, nullable=False, server_default=""),
        sa.Column("referencia", sa.String(60), nullable=False, server_default=""),
        sa.Column("ip", sa.String(64), nullable=False, server_default=""),
        sa.Column("extra", JSONB, nullable=False, server_default="{}"),
    )
    # La auditoría no se puede modificar ni borrar, ni siquiera por error de la aplicación.
    op.execute("""
        CREATE FUNCTION auditoria_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'La auditoría solo admite inserciones'; END $$;
        CREATE TRIGGER auditoria_sin_cambios BEFORE UPDATE OR DELETE ON auditoria
            FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();
        CREATE TRIGGER auditoria_sin_vaciado BEFORE TRUNCATE ON auditoria
            FOR EACH STATEMENT EXECUTE FUNCTION auditoria_inmutable();
    """)
    # La aplicación entra con un rol sin permisos de borrado: solo lo necesario.
    app = os.environ.get("IESS_DB_ROL_APP", "iess_app")
    op.execute(f'GRANT SELECT, INSERT, UPDATE ON usuarios, renovaciones TO "{app}"')
    op.execute(f'GRANT SELECT, INSERT ON auditoria TO "{app}"')


def downgrade() -> None:
    raise RuntimeError("No se revierte: borraría la auditoría.")
